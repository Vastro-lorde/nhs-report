/* ──────────────────────────────────────────
   App layout for authenticated pages
   Includes sidebar + main content area
   ────────────────────────────────────────── */
import { Sidebar } from "@/components/layout";
import { SidebarProvider } from "@/components/layout/SidebarContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen relative">
        <Sidebar />
        {/* ADD pb-20 to prevent Vercel "1 Issue" widget from overlapping our mobile layout */}
        <main className="flex-1 w-full md:ml-64 pb-20 md:pb-0">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
