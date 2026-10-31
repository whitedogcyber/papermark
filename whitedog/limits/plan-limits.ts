import { basePlan } from "@/lib/editions";

/**
 * Per-edition limits. Numbers use Infinity for "unlimited" (sent to the
 * browser as null, which the UI treats as unlimited).
 */
export type FileSizeLimits = {
  video?: number; // MB
  document?: number; // MB
  image?: number; // MB
  excel?: number; // MB
  maxFiles?: number;
  maxPages?: number;
};

export type PlanLimits = {
  users: number;
  links: number;
  documents: number;
  domains: number;
  datarooms: number;
  customDomainOnPro: boolean;
  customDomainInDataroom: boolean;
  advancedLinkControlsOnPro: boolean;
  watermarkOnBusiness: boolean;
  agreementOnBusiness: boolean;
  conversationsInDataroom: boolean;
  dataroomUpload: boolean; // file requests
  fileSizeLimits?: FileSizeLimits;
};

const NONE = {
  customDomainOnPro: false,
  customDomainInDataroom: false,
  advancedLinkControlsOnPro: false,
  watermarkOnBusiness: false,
  agreementOnBusiness: false,
  conversationsInDataroom: false,
  dataroomUpload: false,
};

const U = Infinity;

const PENDING: PlanLimits = {
  ...NONE,
  users: 1,
  links: 0,
  documents: 0,
  domains: 0,
  datarooms: 0,
};

const STARTER: PlanLimits = {
  ...NONE,
  users: 1,
  links: U,
  documents: 300,
  domains: 0,
  datarooms: 0,
};

const ESSENTIALS: PlanLimits = {
  ...NONE,
  users: 3,
  links: U,
  documents: U,
  domains: 5,
  datarooms: 100,
  customDomainOnPro: true,
  fileSizeLimits: { maxFiles: 500 },
};

const LEGACY_DATAROOMS: PlanLimits = {
  ...ESSENTIALS,
  domains: 10,
  customDomainInDataroom: true,
  fileSizeLimits: { maxFiles: 1000 },
};

const PREMIUM: PlanLimits = {
  ...LEGACY_DATAROOMS,
  users: 5,
  domains: U,
  datarooms: U,
  conversationsInDataroom: true,
  dataroomUpload: true,
  fileSizeLimits: { maxFiles: 5000, maxPages: 1000 },
};

const COMPLETE: PlanLimits = { ...PREMIUM, users: 10 };

const BY_PLAN: Record<string, PlanLimits> = {
  free: PENDING,
  starter: STARTER, // legacy
  pro: STARTER,
  business: ESSENTIALS,
  datarooms: LEGACY_DATAROOMS, // legacy
  "datarooms-plus": PREMIUM,
  "datarooms-premium": COMPLETE,
  "datarooms-unlimited": COMPLETE, // legacy
};

export function planLimits(plan?: string | null): PlanLimits {
  return BY_PLAN[basePlan(plan)] ?? PENDING;
}

const NUMERIC = [
  "users",
  "links",
  "documents",
  "domains",
  "datarooms",
] as const;
const FLAGS = [
  "customDomainOnPro",
  "customDomainInDataroom",
  "advancedLinkControlsOnPro",
  "watermarkOnBusiness",
  "agreementOnBusiness",
  "conversationsInDataroom",
  "dataroomUpload",
] as const;

/** Edition limits with a team's admin overrides (team.limits) applied. */
export function effectiveLimits(
  plan: string | null | undefined,
  overrides: unknown,
): PlanLimits {
  const base = planLimits(plan);
  const o = (
    overrides && typeof overrides === "object" ? overrides : {}
  ) as Record<string, unknown>;
  const out: PlanLimits = { ...base };
  for (const key of NUMERIC) {
    const v = o[key];
    if (typeof v === "number" && v >= 0) out[key] = v;
  }
  for (const key of FLAGS) {
    const v = o[key];
    if (typeof v === "boolean") out[key] = v;
  }
  if (o.fileSizeLimits && typeof o.fileSizeLimits === "object") {
    out.fileSizeLimits = {
      ...base.fileSizeLimits,
      ...(o.fileSizeLimits as FileSizeLimits),
    };
  }
  return out;
}
