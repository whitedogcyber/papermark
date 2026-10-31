/**
 * WhiteDog editions on top of Papermark's plans.
 *
 * Papermark's feature checks all key off team.plan, so an edition is a label
 * for one existing plan value. Changing a team's edition = setting team.plan.
 * Browser-safe: no server imports.
 */

export type EditionId = "starter" | "essentials" | "premium" | "complete";

export type Edition = {
  id: EditionId;
  name: string;
  plan: string; // Papermark plan value stored on the team
  users: number; // included team members
  summary: string;
  features: string[];
};

export const EDITIONS: Edition[] = [
  {
    id: "starter",
    name: "Starter",
    plan: "pro",
    users: 1,
    summary: "Secure document sharing for one person.",
    features: [
      "1 team member",
      "300 documents, unlimited links",
      "Custom branding",
      "Video and more file types",
      "Visitor analytics",
    ],
  },
  {
    id: "essentials",
    name: "Essentials",
    plan: "business",
    users: 3,
    summary: "Small teams sharing documents and simple data rooms.",
    features: [
      "3 team members",
      "Unlimited documents",
      "Basic data rooms",
      "Custom domains for documents",
      "Screenshot protection and email verification",
      "Allow and block lists, NDA agreements",
      "Webhooks",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    plan: "datarooms-plus",
    users: 5,
    summary: "Full data rooms for deals and due diligence.",
    features: [
      "5 team members",
      "Unlimited data rooms and custom domains",
      "Data room branding and analytics",
      "Dynamic watermark, file-level permissions, groups",
      "Q&A, viewer audit log, email invites",
      "File requests and change notifications",
      "Automatic indexing",
    ],
  },
  {
    id: "complete",
    name: "Complete",
    plan: "datarooms-premium",
    users: 10,
    summary: "Everything, for larger teams and workflows.",
    features: [
      "10 team members",
      "Everything in Premium",
      "Workflows",
      "Up to 5 teams",
      "Whitelabeling",
      "API access",
      "SSO on request",
    ],
  },
];

/** Plans that exist upstream but are not offered. Teams on them keep working. */
export const LEGACY_PLANS: Record<string, string> = {
  datarooms: "Data Rooms (legacy)",
  starter: "Starter (legacy plan)",
  "datarooms-unlimited": "Unlimited (legacy)",
};

/** Teams on this plan are waiting for an admin to assign an edition. */
export const PENDING_PLAN = "free";
export const PENDING_LABEL = "Pending approval";
export const PENDING_MESSAGE =
  "This workspace is waiting for approval. Request access from the WhiteDog Share team.";

export const basePlan = (plan?: string | null) =>
  (plan || PENDING_PLAN).split("+")[0];

export const isPendingPlan = (plan?: string | null) =>
  basePlan(plan) === PENDING_PLAN;

export const editionById = (id?: string | null) =>
  EDITIONS.find((e) => e.id === id) ?? null;

export const editionForPlan = (plan?: string | null) =>
  EDITIONS.find((e) => e.plan === basePlan(plan)) ?? null;

/** Display name for any stored plan value. */
export function planDisplayName(plan?: string | null): string {
  const base = basePlan(plan);
  if (base === PENDING_PLAN) return PENDING_LABEL;
  return editionForPlan(base)?.name ?? LEGACY_PLANS[base] ?? base;
}

/**
 * Papermark refers to required plans by several spellings ("Business",
 * "Data Rooms Plus", "datarooms-plus", "data rooms plus"). Returns the
 * lowest edition that includes that plan's features.
 */
export function editionForRequirement(name?: string | null): Edition {
  const n = (name || "").toLowerCase().replace(/[\s_]+/g, "-");
  if (n.includes("premium")) return editionById("complete")!;
  if (n.includes("datarooms") || n.includes("data-rooms")) {
    return editionById("premium")!; // Data Rooms and Data Rooms Plus
  }
  if (n.includes("business")) return editionById("essentials")!;
  if (n.includes("pro") || n.includes("starter"))
    return editionById("starter")!;
  return editionById("essentials")!;
}

/** Rank used to decide what counts as an upgrade. Pending = -1. */
export function planRank(plan?: string | null): number {
  const base = basePlan(plan);
  const idx = EDITIONS.findIndex((e) => e.plan === base);
  if (idx >= 0) return idx;
  if (base === "datarooms") return 1.5; // between Essentials and Premium
  if (base === "datarooms-unlimited") return EDITIONS.length - 1;
  return -1;
}
