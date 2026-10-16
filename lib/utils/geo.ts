import { Geo } from "../types";

export function getGeoData(headers: {
  [key: string]: string | string[] | undefined;
}): Geo {
  return {
    city: Array.isArray(headers["x-vercel-ip-city"])
      ? headers["x-vercel-ip-city"][0]
      : headers["x-vercel-ip-city"],
    region: Array.isArray(headers["x-vercel-ip-region"])
      ? headers["x-vercel-ip-region"][0]
      : headers["x-vercel-ip-region"],
    country: Array.isArray(headers["x-vercel-ip-country"])
      ? headers["x-vercel-ip-country"][0]
      : headers["x-vercel-ip-country"],
    latitude: Array.isArray(headers["x-vercel-ip-latitude"])
      ? headers["x-vercel-ip-latitude"][0]
      : headers["x-vercel-ip-latitude"],
    longitude: Array.isArray(headers["x-vercel-ip-longitude"])
      ? headers["x-vercel-ip-longitude"][0]
      : headers["x-vercel-ip-longitude"],
  };
}

type HeaderBag = { [key: string]: string | string[] | undefined };

function pick(headers: HeaderBag | Headers, name: string): string | undefined {
  const raw =
    typeof (headers as Headers).get === "function"
      ? ((headers as Headers).get(name) ?? undefined)
      : (headers as HeaderBag)[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  try {
    return decodeURIComponent(value).trim() || undefined;
  } catch {
    return value.trim() || undefined;
  }
}

/**
 * Self-hosted behind Amazon CloudFront: read the viewer location headers
 * (the distribution's origin request policy must forward them).
 * Returns null when CloudFront geo headers are not present.
 */
export function getCloudFrontGeo(headers: HeaderBag | Headers): {
  continent?: string;
  city?: string;
  region?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
} | null {
  const country = pick(headers, "cloudfront-viewer-country");
  if (!country) return null;
  return {
    country,
    city: pick(headers, "cloudfront-viewer-city"),
    region: pick(headers, "cloudfront-viewer-country-region"),
    latitude: pick(headers, "cloudfront-viewer-latitude"),
    longitude: pick(headers, "cloudfront-viewer-longitude"),
    continent: undefined,
  };
}

/** Viewer IP from CloudFront ("ip:port", IPv6 too), if present. */
export function getCloudFrontIp(
  headers: HeaderBag | Headers,
): string | undefined {
  const addr = pick(headers, "cloudfront-viewer-address");
  if (!addr) return undefined;
  const idx = addr.lastIndexOf(":");
  return idx > 0 ? addr.slice(0, idx) : addr;
}

/**
 * Location for non-Vercel deployments: CloudFront headers when available,
 * otherwise unknown. Never returns the localhost placeholder (Munich).
 */
export function getSelfHostedGeo(headers: HeaderBag | Headers) {
  return getCloudFrontGeo(headers) ?? UNKNOWN_GEO_DATA;
}

export const UNKNOWN_GEO_DATA = {
  continent: undefined as string | undefined,
  city: undefined as string | undefined,
  region: undefined as string | undefined,
  country: undefined as string | undefined,
  latitude: undefined as string | undefined,
  longitude: undefined as string | undefined,
};

export const LOCALHOST_GEO_DATA = {
  continent: "Europe",
  city: "Munich",
  region: "BY",
  country: "DE",
  latitude: "48.137154",
  longitude: "11.576124",
};

export const LOCALHOST_IP = "127.0.0.1";
