import { useRouter } from "next/router";

import { useEffect } from "react";

/** No invoices: editions are assigned, not purchased. */
export default function Invoices() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings/billing");
  }, [router]);
  return null;
}
