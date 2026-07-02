/* ──────────────────────────────────────────
   Notification bell (portal notifications)
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api, type NotificationItem } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications.list({ limit: "10" });
      setItems(res.data);
      setUnread(res.unreadCount);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(load, POLL_INTERVAL_MS);
    // Defer the initial fetch out of the synchronous effect body.
    const kickoff = setTimeout(load, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(kickoff);
    };
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markAllRead() {
    try {
      await api.notifications.markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  }

  async function onItemClick(n: NotificationItem) {
    if (!n.read) {
      try {
        await api.notifications.markRead(n._id);
        setUnread((u) => Math.max(0, u - 1));
        setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-orange-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map((n) => {
                  const content = (
                    <div
                      className={cn(
                        "px-4 py-3 hover:bg-gray-50 cursor-pointer",
                        !n.read && "bg-orange-50/60",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-600" />}
                        <div className={cn(!n.read ? "" : "pl-4")}>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                  return n.link ? (
                    <Link key={n._id} href={n.link} onClick={() => onItemClick(n)}>
                      {content}
                    </Link>
                  ) : (
                    <div key={n._id} onClick={() => onItemClick(n)}>
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
