# Editions

Editions are labels on Papermark's existing plans, so every feature check keeps working.

| Edition | Plan value | Team members |
| --- | --- | --- |
| Starter | `pro` | 1 |
| Essentials | `business` | 3 |
| Premium | `datarooms-plus` | 5 |
| Complete | `datarooms-premium` | 10 |

- **Pending approval** (`free`): every new team starts here. Members can sign in and request an edition, but can't upload, create links or folders, add domains or invite people until an admin assigns one.
- **Legacy** plans (`datarooms`, `starter`, `datarooms-unlimited`) keep working and show as legacy. They are not offered.
- Trials are off. Set `ENABLE_TRIALS=true` to bring back the upstream data room trial.

## Admin

Set `PLATFORM_ADMIN_EMAILS` (comma-separated). Those users get **Admin** in the sidebar (`/admin`):

- **Requests**: approve (optionally with a different edition) or decline, with a note that is emailed to the requester.
- **Teams**: search by team name or a member's email or name, change the edition, and override team members, data rooms and domains for one team. Every change is recorded in `PlanChange`.

## Requests

Every "Upgrade" button in the app opens a request form without pricing. Requests are stored in `UpgradeRequest`, then routed:

| Variable | Effect |
| --- | --- |
| `UPGRADE_REQUEST_EMAILS` | Email recipients. Defaults to `PLATFORM_ADMIN_EMAILS`. |
| `UPGRADE_REQUEST_WEBHOOK_URL` | POSTs JSON (`event`, `request`, `team`, `reviewUrl`). Works with Power Automate, a Teams workflow, a CRM or a ticketing system. |
| `UPGRADE_REQUEST_WEBHOOK_SECRET` | Adds `X-WhiteDog-Signature`, the hex HMAC-SHA256 of the body. |

A team has at most one open request per kind (edition or team members). Sending again updates it.

## Custom domains (self-hosted)

Without `PROJECT_ID_VERCEL`, domains are checked by DNS: valid when the domain has a CNAME to `CUSTOM_DOMAIN_TARGET` (default: the app host) or resolves to the same addresses. The domain must also be added to CloudFront (alternate domain name with an ACM certificate) and covered by the origin certificate, or requests will fail at the CDN.
