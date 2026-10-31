import { useRouter } from "next/router";

import { useEffect } from "react";

/** Upstream pricing page. Editions live under Settings > Edition. */
export default function Upgrade() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings/billing");
  }, [router]);
  return null;
}
