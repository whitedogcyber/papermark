import { metadata } from "@trigger.dev/sdk";

import type { TDocumentProgressStatus } from "./trigger-status";

// Server/task-only: imports the Trigger.dev SDK.
// Client code must import parseStatus from "@/lib/utils/trigger-status".
export { parseStatus } from "./trigger-status";

/**
 * Update the status of the convert document task. Wraps the `metadata.set` method.
 */
export function updateStatus(status: TDocumentProgressStatus) {
  // `metadata.set` can be used to update the status of the task
  // as long as `updateStatus` is called within the task's `run` function.
  metadata.set("status", status);
}
