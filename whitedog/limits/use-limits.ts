import { useTeam } from "@/context/team-context";
import useSWR from "swr";

import { usePlan } from "@/lib/swr/use-billing";
import { fetcher } from "@/lib/utils";

import type { FileSizeLimits } from "./plan-limits";

/** Limits as the browser sees them: null = unlimited. */
export type ClientLimits = {
  users: number | null;
  links: number | null;
  documents: number | null;
  domains: number | null;
  datarooms: number | null;
  customDomainOnPro: boolean;
  customDomainInDataroom: boolean;
  advancedLinkControlsOnPro: boolean;
  watermarkOnBusiness: boolean;
  agreementOnBusiness: boolean;
  conversationsInDataroom: boolean;
  dataroomUpload: boolean;
  fileSizeLimits?: FileSizeLimits;
  usage: { documents: number; links: number; users: number };
};

const under = (used: number | undefined, max: number | null | undefined) =>
  max === null || max === undefined ? true : (used ?? 0) < max;

export function useLimits() {
  const teamId = useTeam()?.currentTeam?.id;
  const { isPending } = usePlan();
  const { data, error } = useSWR<ClientLimits>(
    teamId ? `/api/teams/${teamId}/limits` : null,
    fetcher,
    { dedupingInterval: 30000 },
  );

  return {
    limits: data ?? null,
    canAddDocuments: data ? under(data.usage?.documents, data.documents) : true,
    canAddLinks: data ? under(data.usage?.links, data.links) : true,
    canAddUsers: data ? under(data.usage?.users, data.users) : true,
    showUpgradePlanModal: isPending,
    error,
    loading: !data && !error,
  };
}
