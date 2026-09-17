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
- production deployment configuration

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
