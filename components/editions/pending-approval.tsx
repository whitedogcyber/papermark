import { HourglassIcon } from "lucide-react";

import { BRAND_NAME } from "@/lib/branding";

import { RequestUpgradeForm } from "@/components/editions/request-upgrade";

/** Shown in place of the app for teams that have no edition yet. */
export function PendingApproval() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <HourglassIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">
          Your workspace is waiting for approval
        </h1>
        <p className="text-muted-foreground">
          {`Choose the edition you need and send a request. You can use ${BRAND_NAME} as soon as the WhiteDog Share team approves it.`}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-6">
        <RequestUpgradeForm inDialog={false} trigger="pending_approval" />
      </div>
    </div>
  );
}
