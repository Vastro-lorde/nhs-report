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

/**
 * Recharts sizes its SVG in pixels from the on-screen container. Once cloned
 * into the wider export frame those pixel sizes are stale, so let the SVG scale
 * to its (now wider) container while keeping its aspect ratio.
 */
function fixResponsiveCharts(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>(".recharts-responsive-container").forEach((container) => {
        const wrapper = container.querySelector<HTMLElement>(".recharts-wrapper");
        const svg = container.querySelector<SVGSVGElement>("svg.recharts-surface");
        if (!wrapper || !svg) return;

        const width = parseFloat(svg.getAttribute("width") || "");
        const height = parseFloat(svg.getAttribute("height") || "");
        if (!svg.getAttribute("viewBox") && width && height) {
            svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        }
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        wrapper.style.width = "100%";
    });
}

/** Mount a copy of `element` in a hidden fixed-width iframe and return the clone + iframe. */
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

    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-export-ignore],[data-html2canvas-ignore]").forEach((n) => n.remove());
    fixResponsiveCharts(clone);
    frameDoc.body.appendChild(clone);

    await Promise.all(stylesheetLoads);
    await frameDoc.fonts?.ready;
    await nextFrame();
    await nextFrame();

    // Size the frame to the content so nothing is clipped or scrolled.
    iframe.style.height = `${clone.scrollHeight + 40}px`;
    await nextFrame();

    return { iframe, clone };
}

/**
 * Export `element` as a multi-page A4 PDF whose layout does not depend on the
 * current screen size.
 */
export async function exportElementToPdf(element: HTMLElement, options: ExportPdfOptions): Promise<void> {
    const layoutWidth = options.layoutWidth ?? EXPORT_LAYOUT_WIDTH_PX;
    const backgroundColor = options.backgroundColor ?? "#ffffff";
    const showFooter = options.footer ?? true;

    const { iframe, clone } = await mountInExportFrame(element, layoutWidth, backgroundColor);
    let imgData: string;
    try {
        const { width, height } = clone.getBoundingClientRect();
        const pixelRatio = Math.min(2, Math.sqrt(MAX_CANVAS_AREA_PX / Math.max(1, width * height)));
        imgData = await toPng(clone, { pixelRatio, backgroundColor });
    } finally {
        iframe.remove();
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
