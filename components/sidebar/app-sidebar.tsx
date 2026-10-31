"use client";

import Link from "next/link";
import { useRouter } from "next/router";

import * as React from "react";
import { useEffect, useState } from "react";

import { TeamContextType, initialState, useTeam } from "@/context/team-context";
import { PlanEnum } from "@/ee/stripe/constants";
import Cookies from "js-cookie";
import {
  BrushIcon,
  CogIcon,
  ContactIcon,
  FolderIcon,
  HouseIcon,
  Loader,
  ServerIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "lucide-react";

import { BRAND_NAME } from "@/lib/branding";
import { useFeatureFlags } from "@/lib/hooks/use-feature-flags";
import { SLACK_ENABLED } from "@/lib/integrations/slack/enabled";
import { usePlan } from "@/lib/swr/use-billing";
import useDatarooms from "@/lib/swr/use-datarooms";
import useLimits from "@/lib/swr/use-limits";
import { usePlatformAdmin } from "@/lib/swr/use-platform-admin";
import { useSlackIntegration } from "@/lib/swr/use-slack-integration";
import { cn, nFormatter } from "@/lib/utils";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavUser } from "@/components/sidebar/nav-user";
import { TeamSwitcher } from "@/components/sidebar/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { Progress } from "../ui/progress";
import SlackBanner from "./banners/slack-banner";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const [showSlackBanner, setShowSlackBanner] = useState<boolean | null>(null);
  const { currentTeam, teams, setCurrentTeam, isLoading }: TeamContextType =
    useTeam() || initialState;
  const {
    plan: userPlan,
    planName,
    isAnnualPlan,
    isPro,
    isBusiness,
    isDatarooms,
    isDataroomsPlus,
    isDataroomsPremium,
    isFree,
    isTrial,
  } = usePlan();

  const { limits } = useLimits();
  const { isAdmin } = usePlatformAdmin();
  const linksLimit = limits?.links;
  const documentsLimit = limits?.documents;

  // Check Slack integration status
  const { integration: slackIntegration } = useSlackIntegration({
    enabled: SLACK_ENABLED && !!currentTeam?.id,
  });

  // Check feature flags
  const { features } = useFeatureFlags();

  // Fetch datarooms for the current team
  const { datarooms } = useDatarooms();

  useEffect(() => {
    if (Cookies.get("hideSlackBanner") !== "slack-banner") {
      setShowSlackBanner(true);
    } else {
      setShowSlackBanner(false);
    }
  }, []);

  // Prepare datarooms items for sidebar (limit to first 5, sorted by most recent)
  const dataroomItems =
    datarooms && datarooms.length > 0
      ? datarooms.slice(0, 5).map((dataroom) => ({
          title: dataroom.name,
          url: `/datarooms/${dataroom.id}/documents`,
          current:
            router.pathname.includes("/datarooms/[id]") &&
            String(router.query.id) === String(dataroom.id),
        }))
      : undefined;

  const data = {
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: HouseIcon,
        current: router.pathname.includes("dashboard"),
      },
      {
        title: "All Documents",
        url: "/documents",
        icon: FolderIcon,
        current:
          router.pathname.includes("documents") &&
          !router.pathname.includes("datarooms"),
      },
      {
        title: "All Datarooms",
        url: "/datarooms",
        icon: ServerIcon,
        current: router.pathname === "/datarooms",
        disabled: !isBusiness && !isDatarooms && !isDataroomsPlus && !isTrial,
        trigger: "sidebar_datarooms",
        plan: PlanEnum.Business,
        highlightItem: ["datarooms"],
        isActive:
          router.pathname.includes("datarooms") &&
          (isBusiness || isDatarooms || isDataroomsPlus || isTrial),
        items:
          isBusiness || isDatarooms || isDataroomsPlus || isTrial
            ? dataroomItems
            : undefined,
      },
      {
        title: "Visitors",
        url: "/visitors",
        icon: ContactIcon,
        current: router.pathname.includes("visitors"),
        disabled: isFree && !isTrial,
        trigger: "sidebar_visitors",
        plan: PlanEnum.Pro,
        highlightItem: ["visitors"],
      },
      {
        title: "Workflows",
        url: "/workflows",
        icon: WorkflowIcon,
        current: router.pathname.includes("/workflows"),
        disabled: !features?.workflows,
        trigger: "sidebar_workflows",
        plan: PlanEnum.DataRoomsPlus,
        highlightItem: ["workflows"],
      },
      {
        title: "Branding",
        url: "/branding",
        icon: BrushIcon,
        current:
          router.pathname.includes("branding") &&
          !router.pathname.includes("datarooms"),
      },
      {
        title: "Settings",
        url: "/settings/general",
        icon: CogIcon,
        isActive:
          router.pathname.includes("settings") &&
          !router.pathname.includes("branding") &&
          !router.pathname.includes("datarooms") &&
          !router.pathname.includes("documents"),
        items: [
          {
            title: "General",
            url: "/settings/general",
            current: router.pathname.includes("settings/general"),
          },
          {
            title: "Team",
            url: "/settings/people",
            current: router.pathname.includes("settings/people"),
          },
          {
            title: "Domains",
            url: "/settings/domains",
            current: router.pathname.includes("settings/domains"),
          },
          {
            title: "Webhooks",
            url: "/settings/webhooks",
            current: router.pathname.includes("settings/webhooks"),
          },
          ...(SLACK_ENABLED
            ? [
                {
                  title: "Slack",
                  url: "/settings/slack",
                  current: router.pathname.includes("settings/slack"),
                },
              ]
            : []),
          {
            title: "Edition",
            url: "/settings/billing",
            current: router.pathname.includes("settings/billing"),
          },
        ],
      },
    ],
  };

  if (isAdmin) {
    data.navMain.push({
      title: "Admin",
      url: "/admin",
      icon: ShieldCheckIcon,
      current: router.pathname.startsWith("/admin"),
    } as (typeof data.navMain)[number]);
  }

  // Filter out items that should be hidden based on feature flags
  const filteredNavMain = data.navMain.filter((item) => {
    // Hide workflows if feature flag is not enabled
    if (item.title === "Workflows" && !features?.workflows) {
      return false;
    }
    return true;
  });

  return (
    <Sidebar
      className="bg-gray-50 dark:bg-black"
      sidebarClassName="bg-gray-50 dark:bg-black"
      side="left"
      variant="inset"
      collapsible="icon"
      {...props}
    >
      <SidebarHeader className="gap-y-8">
        <p className="hidden w-full justify-center text-2xl font-bold tracking-tighter text-black group-data-[collapsible=icon]:inline-flex dark:text-white">
          <Link href="/dashboard">{BRAND_NAME.charAt(0)}</Link>
        </p>
        {/* Brand name, with the plan badges on their own line underneath */}
        <div className="ml-2 flex flex-col items-start gap-2 group-data-[collapsible=icon]:hidden">
          <Link
            href="/dashboard"
            className="whitespace-nowrap text-2xl font-bold tracking-tighter text-black dark:text-white"
          >
            {BRAND_NAME}
          </Link>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs tracking-normal ring-1",
              isFree
                ? "bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-200"
                : "bg-background text-foreground ring-gray-800",
            )}
          >
            {planName}
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader className="h-5 w-5 animate-spin" /> Loading teams...
          </div>
        ) : (
          <TeamSwitcher
            currentTeam={currentTeam}
            teams={teams}
            setCurrentTeam={setCurrentTeam}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavMain} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuItem>
            <div>
              {/*
               * Show Slack banner to all users if they haven't dismissed it and don't have Slack connected
               */}
              {SLACK_ENABLED && !slackIntegration && showSlackBanner ? (
                <SlackBanner setShowSlackBanner={setShowSlackBanner} />
              ) : null}

              <div className="mb-2">
                {linksLimit ? (
                  <UsageProgress
                    title="Links"
                    unit="links"
                    usage={limits?.usage?.links}
                    usageLimit={linksLimit}
                  />
                ) : null}
                {documentsLimit ? (
                  <UsageProgress
                    title="Documents"
                    unit="documents"
                    usage={limits?.usage?.documents}
                    usageLimit={documentsLimit}
                  />
                ) : null}
                {linksLimit || documentsLimit ? (
                  <p className="mt-2 px-2 text-xs text-muted-foreground">
                    Change plan to increase usage limits
                  </p>
                ) : null}
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

function UsageProgress(data: {
  title: string;
  unit: string;
  usage?: number;
  usageLimit?: number;
}) {
  let { title, unit, usage, usageLimit } = data;
  let usagePercentage = 0;
  if (usage !== undefined && usageLimit !== undefined) {
    usagePercentage = (usage / usageLimit) * 100;
  }

  return (
    <div className="p-2">
      <div className="mt-1 flex flex-col space-y-1">
        {usage !== undefined && usageLimit !== undefined ? (
          <p className="text-xs text-foreground">
            <span>{nFormatter(usage)}</span> / {nFormatter(usageLimit)} {unit}
          </p>
        ) : (
          <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
        )}
        <Progress value={usagePercentage} className="h-1 bg-muted" max={100} />
      </div>
    </div>
  );
}
