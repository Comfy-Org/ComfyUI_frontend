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

`refresh(expectedUserId?)` reads the session now instead of waiting for the
next beat. It handles the answer as a heartbeat would: the same user keeps the
account with the fresh session, another user goes through `onAccountChanged`,
and sibling tabs hear it. It resolves with the state once the answer, and any
restore it started, has settled. It reads nothing unless the tab is signed in
and, when `expectedUserId` is given, signed in as that user.

The server freezes `email_verified` when it creates the session, so neither a
heartbeat nor `refresh()` sees a later verification. Create the session again
with `signedIn()` after the user verifies.

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
until it passes. `mint()` never throws. `remint()` is `mint()` without the
cached token, for the one retry after a service answers 401.
`getWorkspaceToken()` throws `SessionTokenError`.

### Timeouts

`readWebSession` and the other `./webSession` calls take `timeoutMs` in
`WebSessionOptions`; `createSessionTokenMint` takes it in its options. It caps
each request, body included, and a request that outruns it answers
`SESSION_UNAVAILABLE`, which is retryable. A caller's `signal` still applies.
With no `timeoutMs`, nothing is capped.

## Errors

`WebSessionErrorCode` (`sessionContracts.ts`) is shared by the session calls
and the mint. Only `SESSION_UNAVAILABLE` is retryable.

A mint's 404 means the workspace is unknown, deleted, or not the user's; the
server does not tell these apart, and the remedy is the same: drop the
workspace. `httpStatus` (404) and `serverCode` still tell it from a 403.

| Code                      | Source                                                            | Retryable |
| ------------------------- | ----------------------------------------------------------------- | --------- |
| `NO_SESSION`              | 401 with another code, or no live session at mint time            | no        |
| `SESSION_EXPIRED`         | 401 `session_expired`                                             | no        |
| `SESSION_REVOKED`         | 401 `session_revoked` or `TOKEN_REVOKED`                          | no        |
| `CSRF_STALE`              | 403 `csrf_invalid`                                                | no        |
| `WORKSPACE_ACCESS_DENIED` | 403 `workspace_access_denied`, or a mint's 404 `NOT_FOUND`        | no        |
| `IDENTITY_CHANGED`        | The signed-in user differs from the one the call started for      | no        |
| `SESSION_REQUEST_REFUSED` | Any other 4xx, or a 403 with another code                         | no        |
| `SESSION_UNAVAILABLE`     | 429, 5xx, a network error, an abort or timeout, or an unread body | yes       |

## Per app

| App         | Use                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cloud       | `cloudWebSessionStore.start()` builds the identity, the mint and the authorizer. Ingest calls go through `fetchOnWebSession`, where a `csrf_invalid` refusal asks `refresh()` and retries once if the user is kept with a new token; comfy-api calls take `webSessionResourceHeader`. |
| website     | Header identity and the balance read on the cookie. The authorizer's token path rejects, so the website never mints.                                                                                                                                                                  |
| billing-web | Identity, workspace and billing calls on the cookie, with no mint. See `apps/billing-web/README.md`.                                                                                                                                                                                  |
| platform    | platform.comfy.org (Comfy-Org/platform). Identity on the cookie and a mint for its API calls; a refused mint asks `refresh()` and mints once more if the user is kept.                                                                                                                |
