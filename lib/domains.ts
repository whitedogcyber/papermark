import { promises as dns } from "node:dns";

import {
  DomainConfigResponse,
  DomainResponse,
  DomainVerificationResponse,
} from "@/lib/types";

/**
 * Self-hosted mode (no PROJECT_ID_VERCEL): custom domains are not managed
 * through Vercel. A domain is valid when it points at this app with a CNAME
 * (or resolves to the same addresses as the app host). TLS for the domain is
 * set up outside the app, e.g. as an alternate domain on CloudFront with an
 * ACM certificate.
 */
export const isSelfHostedDomains = () => !process.env.PROJECT_ID_VERCEL;

export const customDomainTarget = () =>
  (
    process.env.CUSTOM_DOMAIN_TARGET ||
    process.env.NEXT_PUBLIC_APP_BASE_HOST ||
    ""
  )
    .toLowerCase()
    .replace(/\.$/, "");

const apexOf = (domain: string) => domain.split(".").slice(-2).join(".");

async function pointsAtApp(domain: string): Promise<boolean> {
  const target = customDomainTarget();
  if (!target) return false;
  try {
    const cnames = await dns.resolveCname(domain);
    if (cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === target)) {
      return true;
    }
  } catch {}
  try {
    const [mine, theirs] = await Promise.all([
      dns.resolve4(target),
      dns.resolve4(domain),
    ]);
    return theirs.length > 0 && theirs.every((ip) => mine.includes(ip));
  } catch {
    return false;
  }
}

async function selfHostedConfig(domain: string) {
  const ok = await pointsAtApp(domain);
  return {
    selfHosted: true,
    configuredBy: "CNAME",
    misconfigured: !ok,
    conflicts: [],
    acceptedChallenges: [],
    recommendedCNAME: [{ rank: 1, value: customDomainTarget() }],
    recommendedIPv4: [],
  } as unknown as DomainConfigResponse;
}

const safeJson = (res: Response) =>
  res.json().catch(() => ({
    error: {
      code: "bad_response",
      message: `Domain service returned ${res.status}`,
    },
  }));

export const addDomainToVercel = async (domain: string) => {
  if (isSelfHostedDomains()) return {};
  return await fetch(
    `https://api.vercel.com/v10/projects/${process.env.PROJECT_ID_VERCEL}/domains?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: domain.toLowerCase(),
      }),
    },
  ).then(safeJson);
};

export const removeDomainFromVercelProject = async (domain: string) => {
  if (isSelfHostedDomains()) return {};
  return await fetch(
    `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain}?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
      },
      method: "DELETE",
    },
  ).then(safeJson);
};

export const removeDomainFromVercelTeam = async (domain: string) => {
  if (isSelfHostedDomains()) return {};
  return await fetch(
    `https://api.vercel.com/v6/domains/${domain}?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
      },
      method: "DELETE",
    },
  ).then(safeJson);
};

export const removeDomainFromVercel = async (
  domain: string,
  domainCount: number,
) => {
  if (domainCount > 1) {
    // the apex domain is being used by other domains
    // so we should only remove it from our Vercel project
    removeDomainFromVercelProject(domain);
  } else {
    // this is the only domain using this apex domain
    // so we can remove it entirely from our Vercel team
    removeDomainFromVercelProject(domain);
    removeDomainFromVercelTeam(domain);
  }
};

export const getDomainResponse = async (
  domain: string,
): Promise<DomainResponse & { error: { code: string; message: string } }> => {
  if (isSelfHostedDomains()) {
    const name = domain.toLowerCase();
    return {
      name,
      apexName: apexOf(name),
      verified: true,
      verification: [],
    } as unknown as DomainResponse & {
      error: { code: string; message: string };
    };
  }
  return await fetch(
    `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain.toLowerCase()}?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  ).then(safeJson);
};

export const getConfigResponse = async (
  domain: string,
): Promise<DomainConfigResponse> => {
  if (isSelfHostedDomains()) return selfHostedConfig(domain.toLowerCase());
  return await fetch(
    `https://api.vercel.com/v6/domains/${domain.toLowerCase()}/config?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  ).then(safeJson);
};

export const verifyDomain = async (
  domain: string,
): Promise<DomainVerificationResponse> => {
  if (isSelfHostedDomains()) {
    return { verified: true } as unknown as DomainVerificationResponse;
  }
  return await fetch(
    `https://api.vercel.com/v9/projects/${process.env.PROJECT_ID_VERCEL}/domains/${domain.toLowerCase()}/verify?teamId=${process.env.TEAM_ID_VERCEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  ).then(safeJson);
};

export { getSubdomain } from "./domain-utils";

export const getApexDomain = (url: string) => {
  let domain;
  try {
    domain = new URL(url).hostname;
  } catch (e) {
    return "";
  }
  const parts = domain.split(".");
  if (parts.length > 2) {
    // if it's a subdomain (e.g. papermark.vercel.app), return the last 2 parts
    return parts.slice(-2).join(".");
  }
  // if it's a normal domain (e.g. papermark.com), we return the domain
  return domain;
};

// courtesy of ChatGPT: https://sharegpt.com/c/pUYXtRs
export const validDomainRegex = new RegExp(
  /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
);
