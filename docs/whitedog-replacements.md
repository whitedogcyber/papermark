# Replacements for Papermark's commercial code

`ee/` and `app/(ee)/` are removed from this fork. Everything they provided is either removed or replaced by WhiteDog code in `whitedog/`, written from the core app's call sites and database schema.

| Upstream (removed) | WhiteDog Share |
| --- | --- |
| `ee/features/storage` | `whitedog/storage` (S3 config from env, tus upload store) |
| `ee/limits` | `whitedog/limits` (limits per edition + admin overrides) |
| `ee/stripe` | `whitedog/plans.ts` (plan names only). Stripe checkout, webhooks and invoices removed. |
| `ee/features/billing` | Removed (no subscriptions) |
| `ee/features/security` | `whitedog/security/rate-limit.ts` (sign-in rate limit). Payment fraud checks removed. |
| `ee/features/permissions` | `whitedog/permissions` (file permissions sheet). Data room links use the standard link sheet. |
| `ee/features/dataroom-invitations` | `whitedog/invitations` |
| `ee/features/conversations`, `app/(ee)/api/faqs` | `whitedog/qa` (Q&A and FAQs) |
| `app/(ee)/api/links/[id]/upload` | `whitedog/file-requests` (uploads wait for the team to add them to the data room) |
| `ee/features/access-notifications` | `whitedog/access-alerts` |
| `ee/features/templates` | `whitedog/templates` (no AI generation) |
| `ee/features/workflows`, `app/(ee)/api/workflow*` | Removed. Workflow links return 404. |
| SSO | `whitedog/auth/middleauth.ts` (OIDC or SAML) |
