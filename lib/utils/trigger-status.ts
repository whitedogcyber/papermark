import { z } from "zod";

// Browser-safe: must not import @trigger.dev/sdk (Node-only in v4).
// Used by client components such as use-progress-status.

const ZDocumentProgressStatus = z.object({
  progress: z.number(),
  text: z.string(),
});

export type TDocumentProgressStatus = z.infer<typeof ZDocumentProgressStatus>;

const ZDocumentProgressMetadata = z.object({
  status: ZDocumentProgressStatus,
});

/**
 * Parse the status from the metadata.
 */
export function parseStatus(data: unknown): TDocumentProgressStatus {
  return ZDocumentProgressMetadata.parse(data).status;
}
