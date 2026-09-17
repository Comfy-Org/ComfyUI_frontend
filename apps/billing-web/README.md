# Billing Web

`@comfyorg/billing-web` is the static Vue/Vite SPA for the hosted Comfy Cloud
billing experience.

## Current scope

This package contains the application shell, routing, localization, test/build
tooling, the hosted embedded subscription checkout presentation, this origin's
own Firebase identity and workspace session, and the Billing SDK composition
over it. The checkout component owns the payment-summary and success layouts
and emits host events for the Billing SDK adapter. It does not contain:

- a server runtime or BFF
- a cookie-backed session transport
- Stripe Elements initialization

The hosted views read the SDK client, but the checkout's confirm action stays
disabled until the payment slice connects it. Billing data, quotes, commands,
and operation state come from the shared `@comfyorg/account-core` Billing SDK;
`src/session/billingWebClient.ts` is the single place the core is constructed.
The billing backend remains owned by the Cloud repository. The existing
frontend Pinia, workspace API, and dialog orchestration are not copied into
this app.

## Authentication

Every route but `/sign-in` requires an authenticated workspace session; the
router guard redirects anyone else to `/sign-in?returnTo=<path>`, and only a
same-origin absolute path is ever honoured as a return destination. The
session is this origin's own: a Firebase identity for the configured project,
exchanged at `${cloud}/api/auth/token` for the workspace-scoped JWT, cached in
`sessionStorage` so it survives a reload but never outlives the tab. Password
recovery stays a single flow, owned by the Cloud app's own page.

## Environment variables

Configure these per deployment (see `.env_example`):

| Variable                            | Required | Meaning                                                                                                                                                                                                                                                                         |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BILLING_ENV`                  | no       | Backend family: `production`, `staging` or `test`. Unset or misspelt resolves to `test`, so a misconfigured deployment cannot reach production Cloud. It selects the Cloud origin (`https://cloud.comfy.org`, `https://stagingcloud.comfy.org`, `https://testcloud.comfy.org`). |
| `VITE_FIREBASE_API_KEY`             | yes      | Firebase web-app config for that family's project.                                                                                                                                                                                                                              |
| `VITE_FIREBASE_AUTH_DOMAIN`         | yes      |                                                                                                                                                                                                                                                                                 |
| `VITE_FIREBASE_PROJECT_ID`          | yes      |                                                                                                                                                                                                                                                                                 |
| `VITE_FIREBASE_APP_ID`              | yes      |                                                                                                                                                                                                                                                                                 |
| `VITE_FIREBASE_DATABASE_URL`        | no       | Carried through to Firebase when set.                                                                                                                                                                                                                                           |
| `VITE_FIREBASE_STORAGE_BUCKET`      | no       |                                                                                                                                                                                                                                                                                 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | no       |                                                                                                                                                                                                                                                                                 |
| `VITE_FIREBASE_MEASUREMENT_ID`      | no       |                                                                                                                                                                                                                                                                                 |

The Firebase project has to belong to the same family as `VITE_BILLING_ENV`: a
token minted against one family is meaningless in another. With any required
variable missing the app still boots and the sign-in page reports that
sign-in is unavailable, rather than throwing at startup.

## Commands

Run these commands from the repository root:

```bash
pnpm dev:cloud:billing-web
pnpm --filter @comfyorg/billing-web dev
pnpm --filter @comfyorg/billing-web typecheck
pnpm --filter @comfyorg/billing-web test:unit
pnpm --filter @comfyorg/billing-web build
```

## Deployment

The app deploys to Vercel as a static SPA from
`apps/billing-web/vercel.json`. Vercel hosts the MVP only;
[ADR-BILLING-WEB-0031](../../docs/adr/BILLING-WEB-0031-static-spa-boundary.md)
targets self-hosted nginx for production billing traffic, so keep the build a
plain directory of static files and express hosting behavior in ways an nginx
rule can reproduce. `.github/workflows/ci-vercel-billing-web-preview.yaml`
builds and deploys it: a preview for a pull request carrying the
`billing-preview` label, and production only when someone dispatches the
workflow against `main`.

Production never follows a merge. Merging to `main` changes nothing that
customers see; a person runs the workflow from the Actions tab (or
`gh workflow run ci-vercel-billing-web-preview.yaml --ref main`) when the
hosted app should change. The job refuses any ref other than `main`, so a
dispatch from a feature branch cannot reach customers.

Previews are opt-in. The workflow triggers on pull requests touching
`apps/billing-web/**`, `packages/design-system/**`,
`packages/tailwind-utils/**`, `public/fonts/**` or `pnpm-workspace.yaml`, and
never on one targeting `core/**` or `cloud/**`. The deploy job then runs only
while the `billing-preview` label is on the pull request, and never from a
fork. Adding the label deploys the current head; removing it stops subsequent
deploys. The path filter keeps the workflow off unrelated pull requests, so the
label alone will not deploy a branch that changes none of those paths.

Vercel project settings:

- Project Name: `billing-web`, under the `comfyui` team. Ingest matches
  `billing-web-<hash>-comfyui.vercel.app` and
  `billing-web-git-<branch>-comfyui.vercel.app` by pattern
  (`services/ingest/server/server.go` in `Comfy-Org/cloud`), so a rename
  CORS-blocks every preview until those patterns change with it.
- Root Directory: `apps/billing-web`, with **Include source files outside of
  the Root Directory** enabled — the build resolves workspace packages.
- Framework Preset: Other. `vercel.json` supplies the install, build, and
  output settings.
- Git integration disabled (`github.enabled: false`); the workflow owns
  deploys.

Both deploy jobs sit behind a `preflight` job that checks the three Vercel
secrets below. While any of them is missing the deploys skip with a notice
instead of failing, so the workflow can merge before the Vercel project exists.

Required GitHub Actions secrets:

| Secret                          | Value                                        |
| ------------------------------- | -------------------------------------------- |
| `VERCEL_BILLING_WEB_ORG_ID`     | Vercel team ID for the `comfyui` scope       |
| `VERCEL_BILLING_WEB_PROJECT_ID` | Project ID of the billing-web Vercel project |
| `VERCEL_BILLING_WEB_TOKEN`      | Vercel access token scoped to the team       |

The token has to carry team scope. A token scoped to the `billing-web`
project alone cannot read project settings — the API answers `403` and
`vercel pull` fails with `Could not retrieve Project Settings`, which reads as
a linking problem rather than a permission one. Narrowing the blast radius
belongs to a dedicated CI account that owns the token, not to the token's
scope.

Client-side routes fall back to `index.html` through the `rewrites` rule. The
rule matches extensionless paths only, so a missing file stays a 404 instead of
returning the HTML shell under a script, style, or font URL. The design-system
stylesheet still carries absolute `/fonts/*.woff2` sources that this app does
not host; they 404 and the browser falls through to the hashed `/assets/` faces
in the same `@font-face` rule.

A custom host is a separate step. `comfy.org` DNS is on Cloudflare, so
`billing.comfy.org` needs a `CNAME` to `cname.vercel-dns.com` there plus the
domain added to the Vercel project. Until that exists, the deployment is
reachable at its `*.vercel.app` host, and the core frontend's
`VITE_BILLING_WEB_URL` must point at whichever origin is live — it accepts
`https` only outside local development.

## Path-prefixed hosting

`VITE_BILLING_WEB_URL` may point at a path prefix, such as
`https://host/billing/`. The router takes its history base from
`import.meta.env.BASE_URL`, which Vite fills in from `base`, so a prefixed
deployment needs nothing beyond the build-time value:

```bash
pnpm --filter @comfyorg/billing-web build --base=/billing/
```

Built assets and history routes then resolve under the same prefix. Which
prefix a deployment uses belongs to the hosting-provider decision deferred in
`docs/adr/BILLING-WEB-0031-static-spa-boundary.md`.

`pnpm dev:cloud:billing-web` runs the Cloud frontend on port 5173 and this app
on port 5174. The command supplies `VITE_BILLING_WEB_URL` to the Cloud frontend.
The hosted entry stays on the provider page until the server's
`hosted_billing_destination` flag resolves to `billing_web` or a developer
opts in from the browser console:

```javascript
localStorage.setItem('ff:hosted_billing_destination', '"billing_web"')
```

Reload the Cloud frontend after changing the override. Existing Subscribe,
Resubscribe, and embedded-checkout actions remain in the core frontend until
the hosted app reaches feature parity.

## Vercel previews

The Vercel project is `billing-web` under the `comfyui` team, so every
deployment answers on `billing-web-<hash>-comfyui.vercel.app` and every branch
on `billing-web-git-<branch>-comfyui.vercel.app`; CI also aliases each pull
request to `comfy-billing-web-preview-pr-<N>.vercel.app`. Ingest's non-prod
`CORS_ORIGIN` and `TOPUP_CHECKOUT_RETURN_HOSTS` sentinels are derived from
those three hostname shapes, so renaming the project or the team is a breaking
change for the Cloud overlays, not a dashboard-only edit.

## Security headers

`vercel.json` sends `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: DENY`
on every response: billing is opened as its own tab and is never embedded.

A Content Security Policy is sent as `Content-Security-Policy-Report-Only`
while the hosted checkout is verified on previews. Report-only means a
violation is logged in the browser console and blocks nothing, so a missing
origin surfaces during review instead of as a payment that silently fails in
production. The allowlist names what the app actually loads:

| Directive     | Origins                                                                                                    | For                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `script-src`  | `js.stripe.com`, `challenges.cloudflare.com`, `apis.google.com`                                            | Stripe.js, Turnstile, the Firebase popup sign-in helper |
| `connect-src` | the three Cloud origins, `api.stripe.com`, the Firebase identity and token endpoints, the two auth domains | billing reads and commands, Elements, sign-in           |
| `frame-src`   | `js.stripe.com`, `hooks.stripe.com`, `challenges.cloudflare.com`, the two auth domains, `apis.google.com`  | Elements, 3DS, Turnstile, the Firebase auth iframe      |
| `style-src`   | `'self' 'unsafe-inline'`                                                                                   | Vue-managed inline styles                               |

The two auth domains are `dreamboothy.firebaseapp.com` (production) and
`dreamboothy-dev.firebaseapp.com` (staging and test), the projects the three
Cloud origins report in `/api/features`. They are spelled out rather than
wildcarded because `*.firebaseapp.com` is every Firebase project there is. A
deployment whose `VITE_FIREBASE_AUTH_DOMAIN` names another project adds that
domain to both directives.

No `report-to` endpoint is set: this origin has no server of its own to
receive reports, so a violation is visible only in the console of a browser
with devtools open. That is the deliberate scope of the report-only phase,
which is verified by hand on previews as described below. After promotion a
violation in production is invisible until a reporting endpoint exists, which
is the first addition to make when one does.

Promote it to `Content-Security-Policy` once a preview has completed sign-in
(email and Google), a card checkout with a 3DS challenge, and a portal
round-trip with no violation in the console. Read each report before acting on
it: add an origin only when the report names an expected, trusted external
resource the flow loads. A report about inline code, a `data:` or `blob:`
source, or framing is a resource to fix or a directive to keep, not a source
to add.
