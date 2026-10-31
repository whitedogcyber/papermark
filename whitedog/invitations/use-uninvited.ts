import { useTeam } from "@/context/team-context";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

export function useUninvitedMembers(dataroomId: string, groupId: string) {
  const teamId = useTeam()?.currentTeam?.id;
  const { data, mutate, error } = useSWR<{ count: number; emails: string[] }>(
    teamId && dataroomId && groupId
      ? `/api/teams/${teamId}/datarooms/${dataroomId}/groups/${groupId}/uninvited`
      : null,
    fetcher,
  );
  return {
    uninvitedCount: data?.count ?? 0,
    uninvitedEmails: data?.emails ?? [],
    loading: !data && !error,
    mutate,
  };
}
