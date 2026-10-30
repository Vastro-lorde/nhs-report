/* ──────────────────────────────────────────
   UI Component: ActionMenu
   A "⋮" trigger that opens a dropdown of row
   actions. The menu is portalled and fixed-
   positioned so table scroll containers
   (overflow-x-auto) can't clip it, and flips
   upward when there's no room below.
   ────────────────────────────────────────── */
"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  /** Navigate to this route when chosen. */
  href?: string;
  /** Run this when chosen (ignored if `href` is set). */
  onSelect?: () => void;
  disabled?: boolean;
  /** Styled in red and separated from the items above it. */
  destructive?: boolean;
  /** Small secondary line, e.g. why the item is disabled. */
  hint?: string;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Accessible name for the trigger button. */
  label?: string;
}

const MENU_WIDTH_PX = 208; // w-52
const VIEWPORT_GAP_PX = 8;

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

export function ActionMenu({ items, label = "Actions" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (refocusTrigger = false) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  };

  // Place the menu against the trigger (measured after mount), then focus the first item.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!open || !trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const height = menu.offsetHeight;
    const fitsBelow = window.innerHeight - rect.bottom >= height + VIEWPORT_GAP_PX;
    const fitsAbove = rect.top >= height + VIEWPORT_GAP_PX;
    const top = !fitsBelow && fitsAbove ? rect.top - height - 4 : rect.bottom + 4;
    const left = Math.max(
      VIEWPORT_GAP_PX,
      Math.min(rect.right - MENU_WIDTH_PX, window.innerWidth - MENU_WIDTH_PX - VIEWPORT_GAP_PX),
    );
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = "visible";

    menu.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
  }, [open]);

  // Dismiss on outside click, scroll or resize — a fixed menu would otherwise drift from its row.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      close();
      return;
    }
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (!nodes.length) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown" ? (index + 1) % nodes.length
      : e.key === "ArrowUp" ? (index - 1 + nodes.length) % nodes.length
      : e.key === "Home" ? 0
      : e.key === "End" ? nodes.length - 1
      : null;
    if (next !== null) {
      e.preventDefault();
      nodes[next].focus();
    }
  };

  const itemClass = (item: ActionMenuItem) =>
    cn(
      "flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm outline-none",
      "focus:bg-gray-100 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
      item.destructive ? "text-red-600 focus:bg-red-50 hover:bg-red-50" : "text-gray-700",
    );

  const itemBody = (item: ActionMenuItem) => (
    <>
      {item.icon && <span className="mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
      <span className="min-w-0">
        <span className="block">{item.label}</span>
        {item.hint && <span className="block text-xs text-gray-400">{item.hint}</span>}
      </span>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors",
          "hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600",
          open && "bg-gray-100 text-gray-700",
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            style={{ position: "fixed", top: 0, left: 0, width: MENU_WIDTH_PX, visibility: "hidden" }}
            className="z-50 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {items.map((item, i) => (
              <Fragment key={item.label}>
                {item.destructive && i > 0 && <div role="separator" className="my-1 border-t border-gray-100" />}
                {item.href && !item.disabled ? (
                  <Link href={item.href} role="menuitem" className={itemClass(item)} onClick={() => close()}>
                    {itemBody(item)}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={itemClass(item)}
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                  >
                    {itemBody(item)}
                  </button>
                )}
              </Fragment>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
