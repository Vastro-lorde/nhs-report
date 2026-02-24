/* ──────────────────────────────────────────
   App layout for authenticated pages
   Includes sidebar + main content area
   ────────────────────────────────────────── */
import { Sidebar } from "@/components/layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  );
}
