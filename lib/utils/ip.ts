type HeaderBag = { [key: string]: string | string[] | undefined };
type HeaderSource = HeaderBag | Headers | { headers: HeaderBag | Headers };

function readHeader(
  headers: HeaderBag | Headers,
  name: string,
): string | undefined {
  const raw =
    typeof (headers as Headers).get === "function"
      ? ((headers as Headers).get(name) ?? undefined)
      : (headers as HeaderBag)[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The visitor's real IP address, consistently across every route.
 *
 * Order: CloudFront-Viewer-Address (set by CloudFront, not spoofable by the
 * client) -> first X-Forwarded-For entry -> X-Real-IP -> 127.0.0.1.
 *
 * Viewer sessions are bound to this IP, so every place that creates or
 * checks a session must use this function. Behind CloudFront, X-Real-IP is
 * the CloudFront edge address, which changes between requests.
 */
export function getClientIp(source: HeaderSource): string {
  const headers =
    "headers" in source && source.headers && typeof source.headers === "object"
      ? (source.headers as HeaderBag | Headers)
      : (source as HeaderBag | Headers);

  const cloudFront = readHeader(headers, "cloudfront-viewer-address");
  if (cloudFront) {
    const idx = cloudFront.lastIndexOf(":");
    return idx > 0 ? cloudFront.slice(0, idx) : cloudFront;
  }

  const forwardedFor = readHeader(headers, "x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first) return first;

  const realIp = readHeader(headers, "x-real-ip");
  if (realIp) return realIp;

  return "127.0.0.1";
}

export function getIpAddress(headers: HeaderBag): string {
  return getClientIp(headers);
}
