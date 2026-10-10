# TDD: SSO sign-in for local ComfyUI

| Field        | Value                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | Draft. Not in the SSO pilot scope (Cloud + Desktop); this records the work so it can be scheduled.                                                |
| Linear       | FE-3099 (frontend). Execution credential: BE-998 follow-up.                                                                                       |
| Decision     | [ADR-AUTH-LOCAL-0043](../adr/AUTH-LOCAL-0043-local-comfyui-signs-in-through-cloud-oauth.md)                                                       |
| Repos        | `Comfy-Org/cloud` (ingest, comfy-api), `comfyanonymous/ComfyUI` (core), `Comfy-Org/ComfyUI_frontend`                                              |
| Out of scope | `--listen` over the LAN and remote hosts (no loopback redirect possible); Desktop local (already shipped behind `desktop_embedded_oauth_session`) |

## Problem

An SSO organization's members are refused Firebase sign-in and personal API
keys (`sso_required`). On local ComfyUI those are the only ways to sign in,
so an SSO member loses API nodes. Desktop local avoids this through the
Desktop main process's OAuth session; a plain browser has no equivalent.

## Current state (verified Oct 10)

**Cloud OAuth (`services/ingest`)**

- Native clients may register loopback redirects. The port is ignored, but
  the path and host must match exactly (`127.0.0.1` and `localhost` are not
  interchangeable). PKCE is S256 only.
- `comfy-desktop` registers `http://127.0.0.1/callback` and
  `http://[::1]/callback`, with `comfy-cloud` scopes.
- `/oauth/token` is public but has no CORS for loopback origins. Loopback
  CORS is limited to an allowlist (`allowsLocalDesktopCORSRequest`:
  `/api/auth/token`, `/api/workspaces`, `/api/features`, `/api/billing/*`,
  and a few more), so a browser page at `127.0.0.1:8188` cannot read the
  token response. There is no revoke endpoint.

**comfy-api** accepts Cloud JWTs with audience `comfy-cloud`, so an OAuth
access token already authenticates API-node requests.

**ComfyUI core** serves `index.html` at `/` and static files below it.
There is no auth route; `GET /callback` returns 404. API nodes read
`auth_token_comfy_org` / `api_key_comfy_org` from the prompt's `extra_data`
and send them as `Authorization: Bearer` / `X-API-KEY`.

**Frontend**

- `src/main.ts` starts the host session only when
  `window.__comfyDesktop2.Auth` exists.
- `src/platform/auth/desktopHost/desktopHostSession.ts` depends only on the
  bridge interface (`getState`, `onChanged`, `getWorkspaceToken`,
  `requestSignIn`, `signOut`, optional `switchWorkspace`). The sign-in
  entry, credential selection, prompt credential and workspace switcher
  already follow it.
- There is no PKCE code anywhere in the repo.

## Work items

### 1. Cloud (backend)

| #   | Item                                                                                                                                                                                                                                                                                                                                                                         | Notes                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| B1  | Seed a native public client for local web (e.g. `comfy-local-web`) with redirects `http://127.0.0.1/`, `http://[::1]/`, `http://localhost/`, and decide its scopes.                                                                                                                                                                                                          | Path `/` means core needs no new route (C1).                              |
| B2  | Allow loopback CORS on `/oauth/token` (code exchange and refresh).                                                                                                                                                                                                                                                                                                           | One allowlist entry.                                                      |
| B3  | Confirm the refresh-token holder fingerprint (IP + User-Agent) tolerates browser refreshes.                                                                                                                                                                                                                                                                                  |                                                                           |
| B4  | Decide whether sign-out needs a revoke endpoint, or whether dropping the tokens is enough.                                                                                                                                                                                                                                                                                   |                                                                           |
| B5  | **Execution credential (option 3, BE-998).** Build the partner-node token from the Notion decision "Renewable partner-node token for Local API nodes" (audience `comfy-partner-node`, partner routes only, renewed by the API-node client, revocable). For local SSO, the mint (`POST /api/auth/token` with `resource: partner-node`) must also accept the OAuth credential. | Shared with Desktop's prod gate. Largest item; design is Feedback Wanted. |

### 2. ComfyUI core

| #   | Item                                                                                                                                                                 | Notes                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| C1  | None if the redirect path is `/`. Otherwise add a route that serves the callback.                                                                                    | A core change needs a core release. |
| C2  | For B5: renew the partner-node token in `comfy_api_nodes/util` before expiry or after a 401, per the Notion decision. No change to `server.py` or the prompt format. | Lands with B5.                      |

### 3. Frontend

| #   | Item                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | PKCE module in `packages/account-core`: verifier and S256 challenge, `state`, authorize URL, code exchange and refresh, with unit tests.                                                      |
| F2  | A browser auth bridge with the `DesktopHostAuthBridge` shape, started from `src/main.ts` when not Cloud, not Desktop, and the flag is on, so the existing host-auth consumers work unchanged. |
| F3  | Handle the return: read `code` and `state` from the URL on boot, check `state`, exchange, then remove them from the URL.                                                                      |
| F4  | Token storage and refresh: access token in memory; refresh token per the security decision (Q2); clear both on sign-out.                                                                      |
| F5  | `getWorkspaceToken` for a workspace switch. `/api/auth/token` does not accept OAuth access tokens, so confirm how Desktop's bridge gets per-workspace tokens and reuse it (may add a B item). |
| F6  | Feature flag (e.g. `local_web_sso`), default off; flag off is today's local sign-in.                                                                                                          |
| F7  | Tests: unit for F1–F4, E2E with a mocked OAuth server for flag off, on and token-endpoint failure.                                                                                            |

### 4. QA and rollout

- Port Desktop cases D1–D11 to web local on staging (sign-in, token,
  fail-closed workspace, partner node, sign-out, flag off, non-SSO user,
  first-time SSO, account switch, workspace switch).
- Turn the flag on gradually and update docs.comfy.org.

## Order

1. Decisions Q1–Q4 below.
2. B1, B2 (small) in parallel with F1, F2, F6.
3. F3, F4, F5 end to end against staging, then QA.
4. B5 and C2 as a separate track; they also unblock Desktop local in prod.

## Related documents

- Notion, Documents Hub:
  - Decision: Renewable partner-node token for Local API nodes (B5, C2).
  - TDD: Resolving stale authentication tokens in Local API Nodes (FE-2170, BE-13269).
  - TDD: SSO across all services (OIDC/SAML/SCIM) and its "Before / after: SSO system design proposal".
  - TDD: Universal Auth Flow for the Comfy Ecosystem.
  - SSO frontend test plan and SSO QA guide (Desktop cases D1–D11 to port).
- Slack: #proj-sso scope thread (Oct 6–7); #bug-dump execution-auth options (Aug 25).

## Open questions

| #   | Question                                                                                            | Owner                      |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------- |
| Q1  | When is local in scope, and for which customers?                                                    | Anupreet                   |
| Q2  | May a refresh token live in browser storage, or is sign-in per browser session acceptable?          | Christian, Deep (security) |
| Q3  | Is loopback-only acceptable, or must `--listen` and remote hosts be covered (device authorization)? | Anupreet, Christian        |
| Q4  | Does the BE-998 gate apply to local the same way it applies to Desktop local?                       | Christian                  |
