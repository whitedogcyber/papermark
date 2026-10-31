import { useRouter } from "next/router";

import { useTeam } from "@/context/team-context";
import Cookies from "js-cookie";

import { usePlan } from "@/lib/swr/use-billing";
import { usePlatformAdmin } from "@/lib/swr/use-platform-admin";

import { PendingApproval } from "@/components/editions/pending-approval";
import { AppBreadcrumb } from "@/components/layouts/breadcrumb";
import TrialBanner from "@/components/layouts/trial-banner";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SIDEBAR_COOKIE_NAME,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { BlockingModal } from "./blocking-modal";

// Pages a team without an edition can still open.
const PENDING_ALLOWED = [
  "/settings/billing",
  "/settings/general",
  "/account",
  "/admin",
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isPending, loading } = usePlan();
  const { isAdmin } = usePlatformAdmin();
  const teamId = useTeam()?.currentTeam?.id;
  const blocked =
    !!teamId &&
    !loading &&
    isPending &&
    !isAdmin &&
    !PENDING_ALLOWED.some((p) => router.pathname.startsWith(p));
  // Default to open (true) if no cookie exists, otherwise use the stored preference
  const cookieValue = Cookies.get(SIDEBAR_COOKIE_NAME);
  const isSidebarOpen =
    cookieValue === undefined ? true : cookieValue === "true";

  return (
    <SidebarProvider defaultOpen={isSidebarOpen}>
      <div className="flex flex-1 flex-col gap-x-1 bg-gray-50 dark:bg-black md:flex-row">
        <AppSidebar />
        <SidebarInset className="ring-1 ring-gray-200 dark:ring-gray-800">
          <header className="flex h-10 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-1 h-4" />
              <AppBreadcrumb />
            </div>
          </header>
          <TrialBanner />
          <BlockingModal />
          <main className="flex-1">
            {loading ? null : blocked ? <PendingApproval /> : children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
