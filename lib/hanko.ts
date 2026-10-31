import { tenant } from "@teamhanko/passkeys-next-auth-provider";

/**
 * Passkey (Hanko) settings, read at runtime so each environment can use its
 * own tenant (passkeys are bound to the site's domain). HANKO_TENANT_ID is
 * preferred; NEXT_PUBLIC_HANKO_TENANT_ID is still accepted. Keys are looked up
 * dynamically so Next.js does not bake build-time values in.
 * Returns null when passkeys are not configured; sign-in then hides them.
 */
export function hankoConfig(): { tenantId: string; apiKey: string } | null {
  const env = process.env as Record<string, string | undefined>;
  const read = (k: string) => (env[k] || "").trim();
  const tenantId =
    read("HANKO_TENANT_ID") || read("NEXT_PUBLIC_HANKO_TENANT_ID");
  const apiKey = read("HANKO_API_KEY");
  if (!tenantId || !apiKey || tenantId === "dummy") return null;
  return { tenantId, apiKey };
}

let client: ReturnType<typeof tenant> | null = null;

export function getHanko() {
  const config = hankoConfig();
  if (!config) throw new Error("Passkeys are not configured");
  client ??= tenant(config);
  return client;
}
