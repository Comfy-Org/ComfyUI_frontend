# ADR-AUTH-SESSION-0037: Shared Web Session on a Host-Only Cookie

Date: 2026-09-24

## Status

Proposed

Builds on the credential lifecycle in
[AUTH-CREDENTIALS-0011](AUTH-CREDENTIALS-0011-cloud-credential-lifecycle-invariants.md)
and the identity ownership in
[AUTH-IDENTITY-0033](AUTH-IDENTITY-0033-account-package-owns-identity-taken-at-construction.md).
Source of truth: the TDD "One Comfy session across comfy.org" (sections 4, 8,
9, 10 and appendix A10). This record keeps only what a maintainer cannot read
off the code.

## Context

Each first-party site (comfy.org, cloud.comfy.org, platform.comfy.org,
billing.comfy.org) runs its own Firebase sign-in, because the browser keeps
each origin's login storage separate. A user signed in on one site is a
stranger on the next, and signing out of one leaves the others signed in.
Every site already calls the Cloud backend (ingest) at the Cloud host, and
the cloud app already sets a cookie there for media loads.

## Decision

1. **One session cookie, host-only on the Cloud host.**
   `__Host-comfy_session`: HttpOnly, Secure, `Path=/`, `SameSite=Lax`, no
   `Domain` attribute, same name in every environment. A browser picks
   cookies by where a request goes, not which page made it, so every site that
   calls ingest with credentials shares the one session, and no other server
   ever receives it. The `__Host-` prefix makes the browser refuse the cookie
   from any other host.
2. **The cookie is an opaque reference to a database row.** 32 random bytes;
   ingest stores only a hash. Sign-out revokes the row, so it holds
   everywhere at once.
3. **The session is provider neutral.** It records a Comfy user. Firebase
   proves identity to create it today; SAML or OIDC can later. The SDK's
   session code imports no identity provider and takes proof of identity as
   an opaque value.
4. **The workspace travels per request, never in the session.**
   `X-Comfy-Workspace-ID` (or `?workspace_id=` where a header cannot go). The
   server treats it as a request and re-checks membership every time.
5. **Unsafe cookie requests carry a stored CSRF token and a trusted Origin.**
   The token is a per-session random value read from `GET /api/auth/session`.
   Ingest refuses any cookie request, reads included, that carries an Origin
   not on an exact trusted-origins list kept separate from CORS. A
   same-origin read carries no Origin, so there the browser's
   `Sec-Fetch-Site: same-origin` label stands in for it; a request with
   neither is refused on the session routes. Unsafe methods always need the
   CSRF token as well.
6. **A new session on every real sign-in.** Signing in replaces whatever
   session the browser held.
7. **Tokens and API keys stay.** CLI, MCP, API keys, Desktop's login handoff,
   a localhost frontend and preview deployments keep the credentials they use
   today. The cookie never reaches localhost or a preview host.
8. **One client flag, and the server owns the AND.** Clients follow
   `unified_web_session` from `/api/features`, default off. The backend serves
   it true only when its own `web_session_enabled` switch is also on for the
   caller; the frontend never combines the two. Flag off is today's behavior,
   byte for byte, so rollback is a flag flip.

### Alternatives rejected

- **A cookie on the whole `.comfy.org` domain.** The decision as first
  recorded (Account Layer TDD, ADR-002), amended in security review on
  2026-09-24. The zone holds more than fifty web hosts, over thirty run by
  outside vendors (Substack, hosted Discourse, Mintlify, HubSpot, Shopify,
  Stripe, Vercel projects and more); each would receive the credential on
  every visit and could log it. A sibling host can set a cookie with the same
  name and domain, which overwrites the victim's cookie rather than sitting
  next to it, and no server-side rule can tell. It would also need twin-cookie
  handling during the switch, per-environment cookie names, and an explicit
  expiry on rollback. It buys one thing, a server other than ingest holding
  the browser's session, and no flow needs that today.
- **A signed, self-contained cookie with no database row.** Cannot be
  revoked, so sign-out would not hold.
- **The workspace inside the cookie.** One cookie is shared by every tab, so
  two tabs could not work in two workspaces, and every switch would rewrite a
  credential.
- **A double-submit CSRF cookie.** It must be readable by scripts and cannot
  be tied to one session; a stored token is bound to exactly one session.
- **Keep tokens for API calls and use the cookie only to carry sign-in.** Two
  credentials per browser forever, the token stays readable by page scripts,
  and media keeps its workspace gap.
- **Teach comfy-api and other services to read the cookie.** An ingest round
  trip on each of their requests and session logic spread across services.
  They get a short-lived workspace token minted from the session instead.
- **A central sign-in site handing out host-only sessions by redirect.** A hop
  per site and a second mechanism for the same result; only worth it for
  shared sign-in across different registrable domains.
- **Rotating the cookie value on a timer.** Sites share one cookie and would
  race each other; the old value would need a grace window.

## Consequences

### Positive

- Sign in once and every first-party site that calls ingest is signed in;
  sign out anywhere and the session ends everywhere.
- The credential is unreadable by page scripts, and only ingest can set or
  overwrite it.
- Two tabs can work in two workspaces, and switching workspace mints nothing.
- Rollback needs no browser cleanup: the cookie never changes scope.

### Negative

- A server other than ingest cannot read the browser's session. Server
  rendered account UI would have to call ingest from the browser or be handed
  a token.
- Every cookie request depends on the trusted-origins list; a first-party
  origin missing from it is refused.
- Rolling back the flag makes a user who reached a site only by session sign
  in there once.
- Until cleanup, the old Firebase media cookie path, the cloud app's
  re-create-on-refresh hooks, and the flag coexist with the session path.

## Notes

Clients that change: the `@comfyorg/account-core` session module and request
headers, the cloud app's API client, WebSocket and media URLs, the website
header and credits, billing-web's identity and transport, and platform's
token exchange. No entity callback, `node.*`, or `graph._version` surface is
touched, so the ADR-CRDT-LAYOUT-0003 and ADR-ECS-0008 extension-migration
clause does not apply.
