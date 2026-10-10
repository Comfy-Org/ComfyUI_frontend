# ADR-AUTH-LOCAL-0043: Local ComfyUI Signs In Through Cloud OAuth

Date: 2026-10-10

## Status

Proposed

## Context

Local ComfyUI (installed from GitHub or pip, opened in a browser at
`127.0.0.1:8188`) signs in with Firebase or a pasted API key. Once an SSO
organization holds an account, Cloud refuses that account's Firebase
sign-in and personal API keys (`sso_required`), so the user loses API
nodes on local with no way back in. Desktop local solved this by signing
in through its own OAuth session (`comfy-desktop` client, loopback
redirect owned by the Electron main process); a browser has no such
process.

The SSO pilot covers Cloud and Desktop only (decided Oct 6–7 in #proj-sso);
local is a follow-up, but it is the most common way ComfyUI is used.

Two separate problems meet here:

1. **Sign-in.** Local needs a credential an SSO user can obtain.
2. **Execution auth.** Local copies the bearer token into each prompt's
   `extra_data.auth_token_comfy_org` at queue time
   (`src/scripts/api.ts`), and core's API nodes send that snapshot to
   comfy-api for submit, upload and poll. A long queue or a slow vendor job
   can outlive the token (#bug-dump, the Seedance 401s), and a revoked
   credential keeps working until the snapshot expires.

Christian listed three options for execution auth (#bug-dump, Aug 25):

1. Keep pushing refreshed tokens from the frontend to ComfyUI and read the
   latest at request time.
2. Make local a real OAuth client with a refreshable credential and
   late-bind the access token on every comfy-api request.
3. Exchange user auth once for a scoped execution credential whose
   lifetime matches the queued/vendor work, and use it for
   submit/upload/poll/output.

## Decision

- **Sign-in follows option 2.** Local signs in with OAuth authorization
  code + PKCE against Cloud, as a native public client with loopback
  redirects, in the browser. The frontend exposes the result through the
  same bridge shape Desktop uses (`DesktopHostAuthBridge`), so the sign-in
  entry, credential selection, prompt credential and workspace switcher
  stay one code path for Desktop and local.
- **Execution auth targets option 3**, as designed in the Notion decision
  "Renewable partner-node token for Local API nodes" (Feedback Wanted):
  at queue time the frontend mints a partner-node token (audience
  `comfy-partner-node`, accepted only on comfy-api's partner routes,
  renewable by the API-node client, revocable by Cloud). Local SSO adds one
  requirement to that design: the mint must accept the OAuth credential,
  not only Firebase, web session and API keys. Until it lands, local uses
  the OAuth access token the way it uses the Firebase token today (same
  lifetime and authority). This is the same gate Christian set for turning
  Desktop local on in prod (BE-998).
- Option 1 is rejected as a long-term design: it ties execution to a live
  frontend tab and breaks for reloads, headless runs and API clients.

## Consequences

### Positive

- SSO users get API nodes back on local with no Firebase dependency.
- Desktop and local share one host-auth path in the frontend.
- Option 3 also fixes the long-job and revocation gaps for every local
  user, not only SSO users.

### Negative

- Loopback redirects only work when ComfyUI is opened on the same machine.
  `--listen` over the LAN and remote hosts (Runpod, tunnels) need another
  flow, such as device authorization.
- A refresh token in browser storage is a new security surface and needs
  review.
- Option 3 needs coordinated Cloud, comfy-api and core releases.

## Notes

The work items and open questions are in
[docs/tdd/2026-10-local-comfyui-sso-sign-in.md](../tdd/2026-10-local-comfyui-sso-sign-in.md).

Related Notion documents (Documents Hub):

- [Decision: Renewable partner-node token for Local API nodes](https://app.notion.com/p/3df6d73d365081b8b765c43406061d97) — Alexander Piskun, Feedback Wanted. The option 3 design this ADR defers to.
- [TDD: Resolving stale authentication tokens in Local API Nodes](https://app.notion.com/p/3d76d73d36508186b202fb04a95cd6fa) — Jaewon Yoon, Approved + WIP. FE-2170, BE-13269; option 1 as the short-term mitigation, option 3 recommended.
- [TDD: SSO across all services (OIDC/SAML/SCIM)](https://app.notion.com/p/3e66d73d3650815c9394f5b6d7d4ff9f) — Deep Mehta, Approved + WIP. The SSO design this work extends.
- [Before / after: SSO system design proposal](https://app.notion.com/p/3e66d73d365081d0b5e4df4eeabf9403) — a subpage of the SSO TDD above. Lists "Sign in with browser" for local.
- [TDD: Universal Auth Flow for the Comfy Ecosystem](https://app.notion.com/p/3256d73d36508141a96df1ec38b123d4) — Christian Byrne, Shipped. OAuth + PKCE for the desktop apps.
