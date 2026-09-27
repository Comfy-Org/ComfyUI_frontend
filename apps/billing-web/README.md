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
session is this origin's own: a Firebase identity for the project its Cloud
origin's `/api/features` names at runtime, exchanged at
`${cloud}/api/auth/token` for the workspace-scoped JWT, cached in
`sessionStorage` so it survives a reload but never outlives the tab. There is
no build-time Firebase configuration and no fallback if that fetch fails: a
stale project surviving a rotation is worse than reporting sign-in
unavailable, since a usable session only ever comes from token exchange at
that same Cloud origin anyway. Password recovery stays a single flow, owned
by the Cloud app's own page.

## Environment variables

Configure these per deployment (see `.env_example`):

| Variable                      | Required | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BILLING_ENV`            | no       | Backend family: `production`, `staging` or `test`. Unset or misspelt resolves to `test`, so a misconfigured deployment cannot reach production Cloud. It selects the Cloud origin (`https://cloud.comfy.org`, `https://stagingcloud.comfy.org`, `https://testcloud.comfy.org`), whose `/api/features` names this deployment's Firebase project. Only needed when the deployment hostname isn't one of the three below — `billing.comfy.org`, `stagingbilling.comfy.org` and `testbilling.comfy.org` self-detect their family and need no override. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | no       | Stripe publishable key for the same family. Without it the checkout surface reports that payment is unavailable and takes no card: there is no hosted-page fallback on `/v1/checkout`. The portal-driven steps (payment methods, invoices) are unaffected, since they open the provider's own hosted portal and need no key.                                                                                                                                                                                                                       |

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
rule can reproduce. Two workflows own the deploys, both driving prebuilt
Vercel CLI deploys rather than Vercel's own git integration:

| Environment | Host                       | Vercel project                               | Trigger                                            |
| ----------- | -------------------------- | -------------------------------------------- | -------------------------------------------------- |
| PR preview  | `*.vercel.app` alias       | `billing-web`                                | `billing-preview` label on a pull request          |
| test        | `testbilling.comfy.org`    | `billing-web-test`                           | every push to `main` touching this app or its deps |
| staging     | `stagingbilling.comfy.org` | `billing-web` (`staging` custom environment) | manual dispatch                                    |
| production  | `billing.comfy.org`        | `billing-web`                                | manual dispatch                                    |

`.github/workflows/ci-vercel-billing-web-preview.yaml` owns the PR preview.
`.github/workflows/ci-vercel-billing-web-deploy.yaml` owns test, staging and
production: a push to `main` deploys test automatically, and a
`workflow_dispatch` with an `environment` choice (`staging` or `production`,
default `staging`) deploys the other two. Both jobs in the deploy workflow
refuse any ref other than `main`, so a dispatch from a feature branch cannot
reach a hosted environment, and test never runs from a fork since it only
triggers on `push`.

Staging and production never follow a merge. Merging to `main` only changes
what test serves; a person runs the deploy workflow from the Actions tab (or
`gh workflow run ci-vercel-billing-web-deploy.yaml --ref main -f
environment=staging`) when either hosted app should change for customers.

Previews are opt-in. The preview workflow triggers on pull requests touching
`apps/billing-web/**`, the workspace packages it imports
(`packages/account-core/**`, `packages/account-ui/**`,
`packages/billing-contract/**`, `packages/design-system/**`,
`packages/ingest-types/**`, `packages/tailwind-utils/**`), `public/fonts/**`
or `pnpm-workspace.yaml`, and never on one targeting `core/**` or `cloud/**`.
The deploy job then runs only while the `billing-preview` label is on the
pull request, and never from a fork. Adding the label deploys the current
head; removing it stops subsequent deploys. The path filter keeps the
workflow off unrelated pull requests, so the label alone will not deploy a
branch that changes none of those paths. The `push`-triggered test deploy
uses the same package list plus `pnpm-lock.yaml`, since a lockfile-only bump
of one of those packages should still refresh test.

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
- Git integration disabled (`github.enabled: false`) on both the
  `billing-web` and `billing-web-test` projects, and both keep their Ignored
  Build Step as `exit 0`. A git-triggered build never deploys; only a
  prebuilt CLI deploy from one of these workflows does.

Every job in both workflows sits behind its own `preflight` job that checks
the Vercel secrets it needs. While any of them is missing, the deploy it
gates skips with a notice instead of failing, so a workflow can merge before
its Vercel project exists.

Required GitHub Actions secrets:

| Secret                               | Value                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `VERCEL_BILLING_WEB_ORG_ID`          | Vercel team ID for the `comfyui` scope                                            |
| `VERCEL_BILLING_WEB_TOKEN`           | Vercel access token scoped to the team                                            |
| `VERCEL_BILLING_WEB_PROJECT_ID`      | Project ID of the `billing-web` Vercel project (PR previews, staging, production) |
| `VERCEL_BILLING_WEB_TEST_PROJECT_ID` | Project ID of the `billing-web-test` Vercel project                               |

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

## Browser tests

`pnpm --filter @comfyorg/billing-web test:e2e` runs the Playwright suite in
`e2e/` against a production build of this app and a Cloud, identity and
payment portal the suite answers in-process; see `e2e/README.md`. CI runs it
as `CI: Billing Web E2E` whenever this app or a package changes.

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
wildcarded because `*.firebaseapp.com` is every Firebase project there is;
naming a Cloud origin's project under a new auth domain needs a CSP update
here alongside it.

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
