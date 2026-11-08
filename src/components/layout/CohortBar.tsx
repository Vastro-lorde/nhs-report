/* ──────────────────────────────────────────
   Cohort indicator, admin cohort switcher and "you're not looking at the
   live cohort" banner — rendered inside the page Header.
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Archive, Layers, Wrench } from "lucide-react";
import { api } from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import { COHORT_STATUS_LABELS, CohortStatus, type CohortContextInfo } from "@/lib/cohort";

// One request per page load, shared by every component that needs it.
// Switching cohort reloads the page, which resets this.
let cachedInfo: Promise<CohortContextInfo> | null = null;

export function useCohortInfo(): CohortContextInfo | null {
  const { status } = useSession();
  const [info, setInfo] = useState<CohortContextInfo | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    cachedInfo ??= api.cohorts.current().catch((err) => {
      cachedInfo = null;
      throw err;
    });
    let alive = true;
    cachedInfo.then((i) => alive && setInfo(i)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [status]);

  return info;
}

/** Switch the admin's view to another cohort (null = the live one) and reload. */
export async function switchCohortView(cohortId: string | null, redirectTo?: string) {
  await api.cohorts.view(cohortId);
  cachedInfo = null;
  if (redirectTo) window.location.href = redirectTo;
  else window.location.reload();
}

export function CohortSwitcher() {
  const { data: session } = useSession();
  const info = useCohortInfo();
  const [busy, setBusy] = useState(false);
  if (!info) return null;

  const isAdmin = session?.user?.role === UserRole.ADMIN;
  if (!isAdmin || !info.cohorts?.length) {
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
        data-tooltip="The programme cohort you are part of"
        data-tooltip-side="bottom"
      >
        <Layers className="h-3.5 w-3.5" />
        {info.active.name}
      </span>
    );
  }

  return (
    <label className="hidden sm:flex items-center gap-1.5 text-xs text-gray-600" data-tooltip="Choose which cohort you are looking at" data-tooltip-side="bottom">
      <Layers className="h-4 w-4 text-gray-500" />
      <span className="sr-only">Cohort</span>
      <select
        className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600 disabled:opacity-50"
        value={info.viewing._id}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          const id = e.target.value;
          await switchCohortView(id === info.active._id ? null : id).catch(() => setBusy(false));
        }}
      >
        {info.cohorts.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name} · {COHORT_STATUS_LABELS[c.status]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CohortBanner() {
  const info = useCohortInfo();
  const [busy, setBusy] = useState(false);
  if (!info?.isViewingOther) return null;

  const back = async () => {
    setBusy(true);
    await switchCohortView(null).catch(() => setBusy(false));
  };

  const isSetup = info.viewing.status === CohortStatus.SETUP;
  return (
    <div
      role="status"
      className={
        isSetup
          ? "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-blue-200 bg-blue-50 px-4 md:px-6 py-2 text-sm text-blue-900"
          : "flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 md:px-6 py-2 text-sm text-amber-900"
      }
    >
      <span className="flex items-center gap-2">
        {isSetup ? <Wrench className="h-4 w-4 shrink-0" /> : <Archive className="h-4 w-4 shrink-0" />}
        {isSetup ? (
          <span>
            You&apos;re setting up <strong>{info.viewing.name}</strong>. It isn&apos;t live yet — changes here don&apos;t
            affect {info.active.name}. Add or edit people using the usual pages.
          </span>
        ) : (
          <span>
            You&apos;re viewing <strong>{info.viewing.name}</strong> (archived). It&apos;s read-only and shows people
            and reports as they were in that cohort.
          </span>
        )}
      </span>
      <span className="flex items-center gap-3 ml-auto">
        {isSetup && (
          <Link href="/admin/cohorts" className="font-medium underline underline-offset-2 hover:no-underline">
            Review &amp; activate
          </Link>
        )}
        <button
          type="button"
          onClick={back}
          disabled={busy}
          className="font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
        >
          Back to {info.active.name}
        </button>
      </span>
    </div>
  );
}
