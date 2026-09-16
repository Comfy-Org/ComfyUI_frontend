# Billing Web

`@comfyorg/billing-web` is the static Vue/Vite SPA for the hosted Comfy Cloud
billing experience.

## Current scope

This package contains the application shell, routing, localization, test/build
tooling, and the hosted embedded subscription checkout presentation. The
checkout component owns the payment-summary and success layouts and emits host
events for the future Billing SDK adapter. It does not contain:

- a server runtime or BFF
- authentication or credential handling
- Billing API calls
- Billing SDK command, quote, or operation state wiring
- Stripe Elements initialization

The payment action stays disabled in the hosted shell until Account/Auth and
subscription Billing SDK integration lands. Billing data, quotes, commands,
and operation state must come from the shared `@comfyorg/account` Billing SDK.
The billing backend remains owned by the Cloud repository. The existing
frontend Pinia, workspace API, and dialog orchestration are not copied into
this app.

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
builds and deploys it: a preview per pull request that touches
`apps/billing-web`, `packages/design-system`, or `packages/tailwind-utils`,
and production on merge to `main`.

Vercel project settings:

- Root Directory: `apps/billing-web`, with **Include source files outside of
  the Root Directory** enabled — the build resolves workspace packages.
- Framework Preset: Other. `vercel.json` supplies the install, build, and
  output settings.
- Git integration disabled (`github.enabled: false`); the workflow owns
  deploys.

Required GitHub Actions secrets:

| Secret                          | Value                                        |
| ------------------------------- | -------------------------------------------- |
| `VERCEL_BILLING_WEB_ORG_ID`     | Vercel team ID for the `comfyui` scope       |
| `VERCEL_BILLING_WEB_PROJECT_ID` | Project ID of the billing-web Vercel project |
| `VERCEL_BILLING_WEB_TOKEN`      | Vercel access token scoped to that project   |

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
