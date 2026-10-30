# SharePoint sync

Links a data room folder (or the data room root) to a SharePoint folder. SharePoint stays the source; Papermark keeps a copy so it can convert pages, watermark and track views.

- New files in SharePoint are added to the data room.
- Changed files become a new version of the same document. Links and analytics are kept.
- Renames and moves are mirrored.
- Files deleted or moved out of the linked folder are removed from the data room. The document and its view history stay in Papermark (under Documents > SharePoint).
- Unlinking stops the sync and leaves everything in place.
- Unsupported file types and files over `SHAREPOINT_MAX_FILE_MB` are skipped and listed in the sync status.

Changes arrive through Microsoft Graph webhooks, usually within a minute. A scheduled check every `SHAREPOINT_POLL_MINUTES` catches anything a webhook missed.

## 1. Entra app

1. Entra admin center > App registrations > New registration, single tenant. Name it `WhiteDog Share`.
2. API permissions > Add > Microsoft Graph > Application permissions > `Sites.Selected`. Grant admin consent.
3. Certificates & secrets > New client secret. Note the tenant ID, client ID and secret.
4. Grant the app access to each site you want to sync (Graph Explorer or PowerShell as a SharePoint admin):

```http
POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
{
  "roles": ["read"],
  "grantedToIdentities": [{ "application": { "id": "<client-id>", "displayName": "WhiteDog Share" } }]
}
```

Get `{site-id}` from `GET https://graph.microsoft.com/v1.0/sites/whitedog.sharepoint.com:/sites/<SiteName>`.

If webhook creation is refused on a site (the app log shows `could not subscribe to drive`), the sync still works by polling. Granting `"write"` instead of `"read"` on that site usually allows webhooks. Papermark never writes to SharePoint.

## 2. Environment

Build arg (GitHub Actions repository variable): `ENABLE_SHAREPOINT=true`

Runtime (Kubernetes secret):

| Variable | Value |
| --- | --- |
| `SHAREPOINT_TENANT_ID` | Entra tenant ID |
| `SHAREPOINT_CLIENT_ID` | App client ID |
| `SHAREPOINT_CLIENT_SECRET` | App client secret |
| `SHAREPOINT_WEBHOOK_SECRET` | Random string, up to 128 chars (`openssl rand -hex 32`) |
| `SHAREPOINT_POLL_MINUTES` | Optional, default `15` |
| `SHAREPOINT_MAX_FILE_MB` | Optional, default `500` |

`NEXTAUTH_URL` must be the public URL. Graph calls `https://share.whitedog.cloud/api/integrations/sharepoint/webhook`, so it must be reachable from the internet with query strings forwarded (already true on CloudFront).

Run `prisma migrate deploy` for the new tables.

## 3. Scheduled check

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: papermark-sharepoint-sync
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: curl
              image: curlimages/curl:8.10.1
              env:
                - name: INTERNAL_API_KEY
                  valueFrom:
                    secretKeyRef: { name: papermark-env, key: INTERNAL_API_KEY }
              args:
                - -fsS
                - -X
                - POST
                - -H
                - "Authorization: Bearer $(INTERNAL_API_KEY)"
                - http://papermark:3000/api/integrations/sharepoint/cron
```

Adjust the secret name and service URL to your deployment. The job renews webhook subscriptions (they expire after about 29 days) and runs overdue syncs.

## Use

Data room > Documents > open the folder > **SharePoint** > paste the site URL > pick the library and folder > **Sync this folder**. Only team admins and managers can link, sync or unlink.
