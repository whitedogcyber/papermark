/**
 * Minimal Microsoft Graph client for the SharePoint sync.
 *
 * App-only auth (client credentials) with one Entra app for the tenant. Grant
 * the app Sites.Selected and give it access only to the sites you want synced.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export class GraphError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "GraphError";
  }
}

export function sharePointConfigured(): boolean {
  return Boolean(
    process.env.SHAREPOINT_TENANT_ID &&
    process.env.SHAREPOINT_CLIENT_ID &&
    process.env.SHAREPOINT_CLIENT_SECRET,
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  if (!sharePointConfigured()) {
    throw new GraphError("SharePoint is not configured", 500);
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.SHAREPOINT_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.SHAREPOINT_CLIENT_ID!,
        client_secret: process.env.SHAREPOINT_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !body.access_token) {
    throw new GraphError(
      `Token request failed: ${body.error_description || body.error || res.status}`,
      res.status,
      body.error,
    );
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch against Graph with auth and retry on throttling. */
export async function graphRaw(
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : GRAPH + pathOrUrl;
  for (let attempt = 0; ; attempt++) {
    const token = await getToken();
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });

    if (res.status === 401 && attempt === 0) {
      cachedToken = null;
      continue;
    }
    if ([429, 503, 504].includes(res.status) && attempt < 5) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 1000 * 2 ** attempt,
      );
      continue;
    }
    return res;
  }
}

export async function graph<T = any>(
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await graphRaw(pathOrUrl, init);
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new GraphError(
      body?.error?.message || `Graph request failed (${res.status})`,
      res.status,
      body?.error?.code,
    );
  }
  return body as T;
}

async function graphAll<T = any>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const page: { value: T[]; "@odata.nextLink"?: string } = await graph(next);
    out.push(...page.value);
    next = page["@odata.nextLink"];
  }
  return out;
}

// ---------- Sites, drives, items ----------

export type GraphSite = { id: string; displayName: string; webUrl: string };
export type GraphDrive = {
  id: string;
  name: string;
  webUrl: string;
  driveType: string;
};
export type GraphDriveItem = {
  id: string;
  name: string;
  size?: number;
  cTag?: string;
  eTag?: string;
  webUrl?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  package?: unknown;
  parentReference?: { id?: string; path?: string; driveId?: string };
};

/**
 * Accepts any SharePoint URL (site home, library view, folder link) and
 * returns the site. Only the /sites/<name> or /teams/<name> part is used.
 */
export async function resolveSite(siteUrl: string): Promise<GraphSite> {
  let url: URL;
  try {
    url = new URL(siteUrl.trim());
  } catch {
    throw new GraphError("Enter a valid SharePoint URL", 400);
  }
  if (!url.hostname.endsWith(".sharepoint.com")) {
    throw new GraphError("The URL must be on *.sharepoint.com", 400);
  }
  const match = decodeURIComponent(url.pathname).match(
    /^\/(sites|teams)\/([^/]+)/i,
  );
  const path = match ? `:/${match[1]}/${match[2]}` : "";
  return graph<GraphSite>(
    `/sites/${url.hostname}${path}?$select=id,displayName,webUrl`,
  );
}

export async function listDrives(siteId: string): Promise<GraphDrive[]> {
  const drives = await graphAll<GraphDrive>(
    `/sites/${siteId}/drives?$select=id,name,webUrl,driveType`,
  );
  return drives.filter((d) => d.driveType === "documentLibrary");
}

const ITEM_SELECT =
  "id,name,size,cTag,eTag,webUrl,file,folder,package,parentReference";

export async function getItem(
  driveId: string,
  itemId: string,
): Promise<GraphDriveItem> {
  const ref = itemId === "root" ? "root" : `items/${itemId}`;
  return graph(`/drives/${driveId}/${ref}?$select=${ITEM_SELECT}`);
}

export async function listChildren(
  driveId: string,
  itemId: string,
): Promise<GraphDriveItem[]> {
  const ref = itemId === "root" ? "root" : `items/${itemId}`;
  return graphAll(
    `/drives/${driveId}/${ref}/children?$select=${ITEM_SELECT}&$top=999`,
  );
}

/** Readable path of an item inside its drive, e.g. "/Deals/Project X". */
export function itemDisplayPath(item: GraphDriveItem): string {
  const parent = item.parentReference?.path ?? "";
  const idx = parent.indexOf("root:");
  if (idx === -1) return "/";
  const rel = decodeURIComponent(parent.slice(idx + 5));
  return `${rel}/${item.name}`.replace(/\/+/g, "/");
}

/** Streams the file content. Graph redirects to a pre-authenticated URL. */
export async function downloadItem(
  driveId: string,
  itemId: string,
): Promise<Response> {
  const res = await graphRaw(`/drives/${driveId}/items/${itemId}/content`);
  if (!res.ok || !res.body) {
    throw new GraphError(`Download failed (${res.status})`, res.status);
  }
  return res;
}

// ---------- Change notifications ----------

// driveItem subscriptions can last at most 42300 minutes (~29.4 days).
const SUBSCRIPTION_MINUTES = 41_000;

export function webhookUrl(): string {
  const base = (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ""
  ).replace(/\/+$/, "");
  return `${base}/api/integrations/sharepoint/webhook`;
}

export function webhookSecret(): string {
  const secret = process.env.SHAREPOINT_WEBHOOK_SECRET;
  if (!secret)
    throw new GraphError("SHAREPOINT_WEBHOOK_SECRET is not set", 500);
  return secret;
}

function expiry(): string {
  return new Date(Date.now() + SUBSCRIPTION_MINUTES * 60_000).toISOString();
}

export async function createSubscription(
  driveId: string,
): Promise<{ id: string; expirationDateTime: string }> {
  return graph("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      changeType: "updated",
      notificationUrl: webhookUrl(),
      resource: `/drives/${driveId}/root`,
      expirationDateTime: expiry(),
      clientState: webhookSecret(),
    }),
  });
}

export async function renewSubscription(
  id: string,
): Promise<{ id: string; expirationDateTime: string }> {
  return graph(`/subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ expirationDateTime: expiry() }),
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  try {
    await graph(`/subscriptions/${id}`, { method: "DELETE" });
  } catch (error) {
    if ((error as GraphError).status !== 404) throw error;
  }
}
