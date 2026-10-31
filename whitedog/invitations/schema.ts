import { z } from "zod";

export const invitationEmailSchema = z.string().trim().toLowerCase().email();

export const MAX_INVITES_PER_REQUEST = 100;

export const inviteBodySchema = z.object({
  emails: z.array(invitationEmailSchema).min(1).max(MAX_INVITES_PER_REQUEST),
  message: z.string().trim().max(2000).optional(),
  linkId: z.string().optional(), // group invites: which group link to send
});

/** Split a pasted list (commas, spaces, new lines) into valid unique emails. */
export function parseEmailList(text: string): {
  valid: string[];
  invalid: string[];
} {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const p of parts) {
    const r = invitationEmailSchema.safeParse(p);
    if (r.success) valid.add(r.data);
    else invalid.push(p);
  }
  return { valid: Array.from(valid), invalid };
}
