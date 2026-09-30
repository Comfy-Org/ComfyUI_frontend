# Web session

Behind the `unified_web_session` flag, every Comfy site shares one sign-in:
the host-only `__Host-comfy_session` cookie that ingest sets at `/api/auth/session`.
The decision and its trade-offs are in
[ADR-AUTH-SESSION-0037](../../../docs/adr/AUTH-SESSION-0037-shared-web-session-on-a-host-only-cookie.md).
This package holds the parts every host reuses. Each host still decides when to
start, and stays on its own sign-in while the flag is off.

## Entry points

| Entry point            | Exports                                                                          | Use it when                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `./webSessionFlag`     | `readWebSessionProbe`, `resolveUnifiedWebSession`                                | A site has no `/api/features` read of its own. Any failure is treated as `false`. |
| `./webSession`         | `readWebSession`, `createWebSession`, `deleteWebSession`, `revokeAllWebSessions` | You need one raw call on `/api/auth/session`.                                     |
| `./webSessionIdentity` | `createWebSessionIdentity`                                                       | You need the session as state: boot, heartbeat, remembered login, account change. |
| `./requestAuth`        | `createRequestAuthorizer`                                                        | You need the credential headers for one request.                                  |
| `./sessionTokenMint`   | `createSessionTokenMint`, `SessionTokenError`                                    | A service cannot read the cookie and needs a Bearer token.                        |
| `./billing`            | `createCredentialedBillingTransport`                                             | Billing calls should go out on the cookie: pass `webSession`.                     |

### Flag

`readWebSessionProbe` is a plain anonymous `GET /api/features`, read for
`web_session_probe`. `resolveUnifiedWebSession` asks the credentialed read only
when the probe is `true`, and answers with that read's `unified_web_session`.

### Identity

`createWebSessionIdentity` reads the session on `boot()`, keeps it alive with a
heartbeat, and restores it from a `RememberedLogin` when the cookie is gone. It
reports an account change through `onAccountChanged`, so a host can drop
user-scoped state.

### Request authorization

`createRequestAuthorizer` returns `{ headers, credentials? }` by principal and
target.

| Principal  | Target     | Result                                                                                                                       |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `session`  | `ingest`   | `X-Comfy-Client`, the `X-Comfy-Workspace-ID` when one is given, `X-CSRF-Token` on non-safe methods, `credentials: 'include'` |
| `session`  | `resource` | `Authorization: Bearer` from `getWorkspaceToken`                                                                             |
| `firebase` | any        | `Authorization: Bearer <id token>`, as today                                                                                 |
| `apiKey`   | any        | `X-API-KEY`, as today                                                                                                        |

### Token mint

`createSessionTokenMint` mints lazily through `POST /api/auth/token`. It caches
one token per (user, workspace) and mints again 60 s before expiry, and the
expiry never exceeds the session's. The backend allows 240 mints per user per
hour. A 429 honours `Retry-After`, capped at 10 minutes, and no request is sent
until it passes. `mint()` never throws. `getWorkspaceToken()` throws
`SessionTokenError`.

## Errors

`WebSessionErrorCode` (`sessionContracts.ts`) is shared by the session calls
and the mint. Only `SESSION_UNAVAILABLE` is retryable.

| Code                      | Source                                                             | Retryable |
| ------------------------- | ------------------------------------------------------------------ | --------- |
| `NO_SESSION`              | 401 with another code, or no live session at mint time             | no        |
| `SESSION_EXPIRED`         | 401 `session_expired`                                              | no        |
| `SESSION_REVOKED`         | 401 `session_revoked`                                              | no        |
| `CSRF_STALE`              | 403 `csrf_invalid`                                                 | no        |
| `WORKSPACE_ACCESS_DENIED` | 403 `workspace_access_denied`                                      | no        |
| `IDENTITY_CHANGED`        | The signed-in user differs from the one the call started for       | no        |
| `SESSION_REQUEST_REFUSED` | Any other 4xx, or a 403 with another code                          | no        |
| `SESSION_UNAVAILABLE`     | 429, 5xx, a network error, an abort, or a body that cannot be read | yes       |

## Per app

| App         | Use                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| cloud       | `cloudWebSessionStore.start()` builds the identity, the mint and the authorizer. Ingest calls go through `fetchOnWebSession`; comfy-api calls take `webSessionResourceHeader`. |
| website     | Header identity and the balance read on the cookie. The authorizer's token path rejects, so the website never mints.                                                           |
| billing-web | Identity, workspace and billing calls on the cookie, with no mint. See `apps/billing-web/README.md`.                                                                           |
