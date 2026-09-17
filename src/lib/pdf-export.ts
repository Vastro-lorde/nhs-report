import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

/**
 * Shared "DOM → PDF" exporter.
 *
 * Every export used to snapshot the live element at whatever width the user's
 * browser happened to be, so a phone produced a stretched single-column PDF and
 * an ultrawide monitor produced a tiny one. This helper instead clones the
 * element into a hidden iframe with a fixed desktop-sized viewport, lets the
 * stylesheets (including Tailwind's responsive breakpoints) re-lay it out
 * there, and captures that. The output is therefore the same regardless of the
 * screen it was generated from.
 */

/** Virtual viewport width every export is laid out at (>= Tailwind `lg`, < `xl`). */
const EXPORT_LAYOUT_WIDTH_PX = 1200;
/** Page margin in mm (A4 is 210 x 297). */
const PAGE_MARGIN_MM = 10;
/** Keep the capture canvas under Safari's ~16.7M pixel limit. */
const MAX_CANVAS_AREA_PX = 16_000_000;

export interface ExportPdfOptions {
    /** File name; ".pdf" is appended if missing. */
    filename: string;
    /** Override the virtual layout width (px). */
    layoutWidth?: number;
    /** Page background colour. */
    backgroundColor?: string;
    /** Render a "Generated … · Page x of y" footer on every page. Defaults to true. */
    footer?: boolean;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load generated image for PDF export"));
        img.src = src;
    });
}

const CHART_CONTAINER = ".recharts-responsive-container";
/** A re-rendered chart is considered settled once its DOM has been untouched for this long. */
const CHART_QUIET_MS = 300;
/** Never settle sooner than this: Recharts animations start after a delay (default 400ms). */
const CHART_SETTLE_MIN_MS = 700;
/** Hard cap on waiting for chart animations (Recharts pie labels appear after ~2s). */
const CHART_SETTLE_MAX_MS = 4000;
/** Recharts hides pie labels until its animation ends, with no DOM activity in between. */
const PIE_LABEL = ".recharts-pie-labels text, .recharts-pie-label-text";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolve once `root` has had no DOM mutations for `quietMs` (but never before
 * `minMs` has elapsed), or after `maxMs` regardless.
 */
function waitForQuietDom(root: Element, { quietMs, minMs, maxMs }: { quietMs: number; minMs: number; maxMs: number }) {
    return new Promise<void>((resolve) => {
        const startedAt = Date.now();
        let quietTimer: ReturnType<typeof setTimeout>;
        const observer = new MutationObserver(() => {
            clearTimeout(quietTimer);
            quietTimer = setTimeout(onQuiet, quietMs);
        });
        const maxTimer = setTimeout(finish, maxMs);
        function onQuiet() {
            const remaining = minMs - (Date.now() - startedAt);
            if (remaining > 0) quietTimer = setTimeout(onQuiet, remaining);
            else finish();
        }
        function finish() {
            observer.disconnect();
            clearTimeout(quietTimer);
            clearTimeout(maxTimer);
            resolve();
        }
        observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
        quietTimer = setTimeout(onQuiet, quietMs);
    });
}

function chartSurface(container: Element): SVGSVGElement | null {
    // Only the chart's own top-level surface — legend icons are also `svg.recharts-surface`
    // and, in Recharts 3, the legend wrapper precedes the chart SVG in DOM order.
    return container.querySelector<SVGSVGElement>(".recharts-wrapper > svg.recharts-surface");
}

/**
 * Recharts draws its SVG at the pixel size of its on-screen container, so a
 * clone taken on a phone carries a narrow chart into the wide export layout.
 * Scaling that SVG never looks right (its aspect ratio is wrong for the desktop
 * card), so instead we temporarily set each live chart container to the width
 * it will have in the export frame and let Recharts re-render it. Returns a
 * function that restores the live page.
 */
async function syncLiveChartsToFrame(element: HTMLElement, frameClone: HTMLElement): Promise<() => void> {
    const liveContainers = Array.from(element.querySelectorAll<HTMLElement>(CHART_CONTAINER));
    const frameContainers = Array.from(frameClone.querySelectorAll<HTMLElement>(CHART_CONTAINER));
    if (liveContainers.length === 0 || liveContainers.length !== frameContainers.length) return () => {};

    const restores: Array<() => void> = [];
    const pending: Array<{ container: HTMLElement; targetWidth: number; pieLabels: number }> = [];

    liveContainers.forEach((container, i) => {
        const targetWidth = Math.round(frameContainers[i].getBoundingClientRect().width);
        const currentWidth = Math.round(container.getBoundingClientRect().width);
        if (!targetWidth || Math.abs(targetWidth - currentWidth) <= 1) return;

        const pieLabels = container.querySelectorAll(PIE_LABEL).length;
        const prevWidth = container.style.width;
        const prevMaxWidth = container.style.maxWidth;
        container.style.width = `${targetWidth}px`;
        container.style.maxWidth = "none";
        restores.push(() => {
            container.style.width = prevWidth;
            container.style.maxWidth = prevMaxWidth;
        });
        pending.push({ container, targetWidth, pieLabels });
    });

    const restore = () => restores.forEach((fn) => fn());
    if (pending.length === 0) return restore;

    // Wait for Recharts' ResizeObserver to redraw each chart at the new width, for any pie labels
    // it hid during the re-render to come back, and for animations (which mutate the SVG every frame) to stop.
    const deadline = Date.now() + CHART_SETTLE_MAX_MS;
    while (Date.now() < deadline) {
        await nextFrame();
        const done = pending.every(({ container, targetWidth, pieLabels }) => {
            const svg = chartSurface(container);
            const resized = svg && Math.abs(parseFloat(svg.getAttribute("width") || "0") - targetWidth) <= 2;
            return resized && container.querySelectorAll(PIE_LABEL).length >= pieLabels;
        });
        if (done) break;
        await sleep(50);
    }
    await waitForQuietDom(element, { quietMs: CHART_QUIET_MS, minMs: CHART_SETTLE_MIN_MS, maxMs: CHART_SETTLE_MAX_MS });
    return restore;
}

function buildClone(element: HTMLElement): HTMLElement {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-export-ignore],[data-html2canvas-ignore]").forEach((n) => n.remove());
    // html-to-image copies *computed* styles, so an `mx-auto` centred element would carry a
    // resolved pixel margin into the capture and be shifted/clipped. Pin it to the frame's origin.
    clone.style.margin = "0";
    clone.style.position = "static";
    clone.style.transform = "none";
    return clone;
}

async function settleFrame(iframe: HTMLIFrameElement, clone: HTMLElement) {
    await nextFrame();
    await nextFrame();
    // Size the frame to the content so nothing is clipped or scrolled.
    iframe.style.height = `${clone.scrollHeight + 40}px`;
    await nextFrame();
}

/**
 * Mount a copy of `element` in a hidden fixed-width iframe and return the clone,
 * the iframe, and a function that undoes any temporary changes to the live page.
 */
async function mountInExportFrame(element: HTMLElement, layoutWidth: number, backgroundColor: string) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.cssText = [
        "position:fixed",
        "top:0",
        `left:-${layoutWidth + 200}px`,
        `width:${layoutWidth}px`,
        "height:1000px",
        "border:0",
        "opacity:0",
        "pointer-events:none",
    ].join(";");
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument;
    if (!frameDoc) {
        iframe.remove();
        throw new Error("Could not create export frame");
    }

    frameDoc.open();
    frameDoc.write("<!DOCTYPE html><html><head></head><body></body></html>");
    frameDoc.close();

    // Carry theme/CSS-variable classes across so global styles resolve the same way.
    frameDoc.documentElement.className = document.documentElement.className;
    frameDoc.documentElement.setAttribute("lang", document.documentElement.getAttribute("lang") || "en");
    frameDoc.body.className = document.body.className;

    // Copy every stylesheet (Next injects <link> in prod and <style> in dev).
    const stylesheetLoads: Promise<void>[] = [];
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        if (clone.tagName === "LINK") {
            stylesheetLoads.push(
                new Promise<void>((resolve) => {
                    clone.onload = () => resolve();
                    clone.onerror = () => resolve();
                })
            );
        }
        frameDoc.head.appendChild(clone);
    });

    const baseStyle = frameDoc.createElement("style");
    baseStyle.textContent = `html,body{margin:0;padding:0;background:${backgroundColor};}`;
    frameDoc.head.appendChild(baseStyle);

    // Pass 1: lay the content out at the export width to learn each chart's target size.
    let clone = buildClone(element);
    frameDoc.body.appendChild(clone);
    await Promise.all(stylesheetLoads);
    await frameDoc.fonts?.ready;
    await settleFrame(iframe, clone);

    // Pass 2: if any chart needs re-rendering at that size, do it on the live page and re-clone.
    const restoreLivePage = await syncLiveChartsToFrame(element, clone);
    try {
        if (element.querySelector(CHART_CONTAINER)) {
            clone.remove();
            clone = buildClone(element);
            frameDoc.body.appendChild(clone);
            await settleFrame(iframe, clone);
        }
    } catch (err) {
        restoreLivePage();
        iframe.remove();
        throw err;
    }

    return { iframe, clone, restoreLivePage };
}

/**
 * Export `element` as a multi-page A4 PDF whose layout does not depend on the
 * current screen size.
 */
export async function exportElementToPdf(element: HTMLElement, options: ExportPdfOptions): Promise<void> {
    const layoutWidth = options.layoutWidth ?? EXPORT_LAYOUT_WIDTH_PX;
    const backgroundColor = options.backgroundColor ?? "#ffffff";
    const showFooter = options.footer ?? true;

    const { iframe, clone, restoreLivePage } = await mountInExportFrame(element, layoutWidth, backgroundColor);
    let imgData: string;
    try {
        const { width, height } = clone.getBoundingClientRect();
        const pixelRatio = Math.min(2, Math.sqrt(MAX_CANVAS_AREA_PX / Math.max(1, width * height)));
        imgData = await toPng(clone, { pixelRatio, backgroundColor });
    } finally {
        iframe.remove();
        restoreLivePage();
    }

    const img = await loadImage(imgData);

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;
    const contentHeight = pageHeight - PAGE_MARGIN_MM * 2 - (showFooter ? 6 : 0);
    const mmPerPx = contentWidth / img.naturalWidth;
    const pageHeightPx = contentHeight / mmPerPx;

    // Slice the tall capture into page-sized strips so each PDF page only carries its own portion.
    const sliceCanvas = document.createElement("canvas");
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    let y = 0;
    let pageIndex = 0;
    while (y < img.naturalHeight) {
        const sliceHeight = Math.min(pageHeightPx, img.naturalHeight - y);
        sliceCanvas.width = img.naturalWidth;
        sliceCanvas.height = Math.ceil(sliceHeight);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(img, 0, y, img.naturalWidth, sliceHeight, 0, 0, img.naturalWidth, sliceHeight);

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
            sliceCanvas.toDataURL("image/jpeg", 0.95),
            "JPEG",
            PAGE_MARGIN_MM,
            PAGE_MARGIN_MM,
            contentWidth,
            sliceHeight * mmPerPx
        );

        y += sliceHeight;
        pageIndex += 1;
    }

    if (showFooter) {
        const total = pdf.getNumberOfPages();
        const generated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        for (let i = 1; i <= total; i++) {
            pdf.setPage(i);
            pdf.text(`Generated ${generated}`, PAGE_MARGIN_MM, pageHeight - PAGE_MARGIN_MM + 2);
            pdf.text(`Page ${i} of ${total}`, pageWidth - PAGE_MARGIN_MM, pageHeight - PAGE_MARGIN_MM + 2, { align: "right" });
        }
    }

    pdf.save(options.filename.endsWith(".pdf") ? options.filename : `${options.filename}.pdf`);
}
