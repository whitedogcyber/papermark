import useSWR from "swr";

import { fetcher } from "@/lib/utils";

export function usePlatformAdmin() {
  const { data } = useSWR<{ isAdmin: boolean }>("/api/admin/me", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return { isAdmin: !!data?.isAdmin, loading: !data };
}
