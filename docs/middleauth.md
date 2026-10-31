# MiddleAuth sign-in

Team members sign in with MiddleAuth, a passkey or an email link. Google and LinkedIn sign-in are removed. Passkeys show when `HANKO_API_KEY` and `HANKO_TENANT_ID` are set; users register one under Account > Security after signing in. Data room visitors are not affected.

Accounts are matched by email address, so anyone who signed in by email before keeps their account and teams.

## OIDC (preferred)

Register WhiteDog Share in MiddleAuth as a confidential web client:

- Redirect URI: `https://share.whitedog.cloud/api/auth/callback/middleauth`
- Scopes: `openid email profile`

Set:

| Variable | Value |
| --- | --- |
| `MIDDLEAUTH_OIDC_ISSUER` | Issuer URL (its `/.well-known/openid-configuration` must be reachable) |
| `MIDDLEAUTH_OIDC_CLIENT_ID` | Client ID |
| `MIDDLEAUTH_OIDC_CLIENT_SECRET` | Client secret |

## SAML 2.0

Used only when OIDC is not configured.

- ACS URL: `https://share.whitedog.cloud/api/auth/saml/acs`
- Entity ID: `https://share.whitedog.cloud/api/auth/saml/metadata` (or `MIDDLEAUTH_SAML_ISSUER`)
- SP metadata: `https://share.whitedog.cloud/api/auth/saml/metadata`
- NameID format: email address. Assertions must be signed.
- Email is read from the `email` or `mail` attribute, or the NameID.

| Variable | Value |
| --- | --- |
| `MIDDLEAUTH_SAML_ENTRY_POINT` | IdP single sign-on URL |
| `MIDDLEAUTH_SAML_IDP_CERT` | IdP signing certificate (PEM). Separate several with `\|\|\|` during rotation. |
| `MIDDLEAUTH_SAML_ISSUER` | Optional SP entity ID |

The SAML response is exchanged for a one-time ticket in Redis (2 minutes) and finished at `/login/saml`.
