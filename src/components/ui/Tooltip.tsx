/* ──────────────────────────────────────────
   UI Component: Tooltip
   Decoupled, reusable tooltip with portal rendering,
   smart boundary collision avoidance, keyboard accessibility,
   and optional global data-tooltip event delegation.
   ────────────────────────────────────────── */
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type TooltipSide = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "start" | "center" | "end";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  delayDuration?: number;
  sideOffset?: number;
  disabled?: boolean;
  className?: string;
  asChild?: boolean;
}

interface TooltipCoords {
  top: number;
  left: number;
  actualSide: TooltipSide;
}

interface TooltipContextType {
  isProviderActive: boolean;
}

const TooltipContext = createContext<TooltipContextType>({
  isProviderActive: false,
});

/**
 * Calculates absolute coordinates in viewport space with boundary flipping & clamping.
 */
function computeTooltipPosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferredSide: TooltipSide = "top",
  preferredAlign: TooltipAlign = "center",
  sideOffset: number = 6
): TooltipCoords {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 8;

  let side = preferredSide;

  // Flip if requested side does not have enough clearance
  if (side === "top" && triggerRect.top - tooltipRect.height - sideOffset < padding) {
    side = "bottom";
  } else if (
    side === "bottom" &&
    triggerRect.bottom + tooltipRect.height + sideOffset > viewportHeight - padding
  ) {
    side = "top";
  } else if (side === "left" && triggerRect.left - tooltipRect.width - sideOffset < padding) {
    side = "right";
  } else if (
    side === "right" &&
    triggerRect.right + tooltipRect.width + sideOffset > viewportWidth - padding
  ) {
    side = "left";
  }

  let top = 0;
  let left = 0;

  if (side === "top" || side === "bottom") {
    top =
      side === "top"
        ? triggerRect.top - tooltipRect.height - sideOffset
        : triggerRect.bottom + sideOffset;

    if (preferredAlign === "start") {
      left = triggerRect.left;
    } else if (preferredAlign === "end") {
      left = triggerRect.right - tooltipRect.width;
    } else {
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    }
  } else {
    // Left or right
    left =
      side === "left"
        ? triggerRect.left - tooltipRect.width - sideOffset
        : triggerRect.right + sideOffset;

    if (preferredAlign === "start") {
      top = triggerRect.top;
    } else if (preferredAlign === "end") {
      top = triggerRect.bottom - tooltipRect.height;
    } else {
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
    }
  }

  // Constrain within viewport boundaries
  left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding));
  top = Math.max(padding, Math.min(top, viewportHeight - tooltipRect.height - padding));

  return { top, left, actualSide: side };
}

/**
 * Reusable, decoupled Tooltip component.
 * Can wrap any button, link, icon, or element.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 150,
  sideOffset = 6,
  disabled = false,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const id = useId();

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const computed = computeTooltipPosition(
      triggerRect,
      tooltipRect,
      side,
      align,
      sideOffset
    );
    setCoords(computed);
  }, [side, align, sideOffset]);

  const showTooltip = useCallback(() => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delayDuration);
  }, [disabled, content, delayDuration]);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    setCoords(null);
  }, []);

  useEffect(() => {
    if (isVisible) {
      updatePosition();

      const handleScrollOrResize = () => {
        updatePosition();
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          hideTooltip();
        }
      };

      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isVisible, updatePosition, hideTooltip]);

  if (!content || disabled) {
    return <>{children}</>;
  }

  // Handle trigger element events
  const handlePointerEnter = () => showTooltip();
  const handlePointerLeave = () => hideTooltip();
  const handleFocus = () => showTooltip();
  const handleBlur = () => hideTooltip();

  let triggerElement: ReactNode;

  if (React.isValidElement(children)) {
    const childElement = children as ReactElement<{
      onPointerEnter?: (e: React.PointerEvent) => void;
      onPointerLeave?: (e: React.PointerEvent) => void;
      onFocus?: (e: React.FocusEvent) => void;
      onBlur?: (e: React.FocusEvent) => void;
      className?: string;
      ref?: React.Ref<unknown>;
      "aria-describedby"?: string;
    }>;

    triggerElement = React.cloneElement(childElement, {
      ref: (node: HTMLElement | null) => {
        triggerRef.current = node;
        const existingRef = (childElement as { ref?: React.Ref<unknown> }).ref;
        if (typeof existingRef === "function") {
          existingRef(node);
        } else if (existingRef && typeof existingRef === "object" && "current" in existingRef) {
          (existingRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }
      },
      onPointerEnter: (e: React.PointerEvent) => {
        childElement.props.onPointerEnter?.(e);
        handlePointerEnter();
      },
      onPointerLeave: (e: React.PointerEvent) => {
        childElement.props.onPointerLeave?.(e);
        handlePointerLeave();
      },
      onFocus: (e: React.FocusEvent) => {
        childElement.props.onFocus?.(e);
        handleFocus();
      },
      onBlur: (e: React.FocusEvent) => {
        childElement.props.onBlur?.(e);
        handleBlur();
      },
      "aria-describedby": isVisible ? id : childElement.props["aria-describedby"],
    });
  } else {
    triggerElement = (
      <span
        ref={(node) => {
          triggerRef.current = node;
        }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="inline-flex"
        aria-describedby={isVisible ? id : undefined}
      >
        {children}
      </span>
    );
  }

  const tooltipPortal =
    mounted && isVisible
      ? createPortal(
          <div
            ref={(node) => {
              tooltipRef.current = node;
              if (node && !coords) {
                updatePosition();
              }
            }}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords ? `${coords.top}px` : "-9999px",
              left: coords ? `${coords.left}px` : "-9999px",
              opacity: coords ? 1 : 0,
              visibility: coords ? "visible" : "hidden",
            }}
            className={cn(
              "z-[9999] pointer-events-none select-none rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md transition-opacity duration-150 border border-gray-800 ring-1 ring-white/10 max-w-xs text-center whitespace-normal break-words leading-tight",
              className
            )}
          >
            {content}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {triggerElement}
      {tooltipPortal}
    </>
  );
}

/**
 * Global Tooltip Provider that listens for `data-tooltip="..."` attributes on any
 * button, link, or element, providing instant hover tooltips without manual JSX wrapping.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!activeElement || !tooltipRef.current) return;
    const triggerRect = activeElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    const side = (activeElement.getAttribute("data-tooltip-side") as TooltipSide) || "top";
    const align = (activeElement.getAttribute("data-tooltip-align") as TooltipAlign) || "center";

    const computed = computeTooltipPosition(triggerRect, tooltipRect, side, align, 6);
    setCoords(computed);
  }, [activeElement]);

  useEffect(() => {
    if (activeElement && tooltipContent) {
      updatePosition();

      const handleScrollOrResize = () => {
        updatePosition();
      };

      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);

      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [activeElement, tooltipContent, updatePosition]);

  useEffect(() => {
    function findTooltipTarget(target: EventTarget | null): HTMLElement | null {
      if (!target || !(target instanceof Element)) return null;
      const el = target.closest("[data-tooltip]") as HTMLElement | null;
      if (el && el.getAttribute("data-tooltip")?.trim()) {
        return el;
      }
      return null;
    }

    function handlePointerOver(e: PointerEvent) {
      // Don't trigger on touch devices to avoid sticky mobile tooltips
      if (e.pointerType === "touch") return;

      const target = findTooltipTarget(e.target);
      if (!target) return;

      const text = target.getAttribute("data-tooltip");
      if (!text) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActiveElement(target);
        setTooltipContent(text);
      }, 150);
    }

    function handlePointerOut(e: PointerEvent) {
      const target = findTooltipTarget(e.target);
      if (!target) return;

      // If moving within the same target, ignore
      if (e.relatedTarget && target.contains(e.relatedTarget as Node)) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      setActiveElement(null);
      setTooltipContent(null);
      setCoords(null);
    }

    function handleFocusIn(e: FocusEvent) {
      const target = findTooltipTarget(e.target);
      if (!target) return;

      const text = target.getAttribute("data-tooltip");
      if (!text) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      setActiveElement(target);
      setTooltipContent(text);
    }

    function handleFocusOut(e: FocusEvent) {
      const target = findTooltipTarget(e.target);
      if (!target) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      setActiveElement(null);
      setTooltipContent(null);
      setCoords(null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (timerRef.current) clearTimeout(timerRef.current);
        setActiveElement(null);
        setTooltipContent(null);
        setCoords(null);
      }
    }

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <TooltipContext.Provider value={{ isProviderActive: true }}>
      {children}
      {mounted && activeElement && tooltipContent
        ? createPortal(
            <div
              ref={(node) => {
                tooltipRef.current = node;
                if (node && !coords) {
                  updatePosition();
                }
              }}
              role="tooltip"
              style={{
                position: "fixed",
                top: coords ? `${coords.top}px` : "-9999px",
                left: coords ? `${coords.left}px` : "-9999px",
                opacity: coords ? 1 : 0,
                visibility: coords ? "visible" : "hidden",
              }}
              className="z-[9999] pointer-events-none select-none rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md transition-opacity duration-150 border border-gray-800 ring-1 ring-white/10 max-w-xs text-center whitespace-normal break-words leading-tight"
            >
              {tooltipContent}
            </div>,
            document.body
          )
        : null}
    </TooltipContext.Provider>
  );
}

export function useTooltip() {
  return useContext(TooltipContext);
}
