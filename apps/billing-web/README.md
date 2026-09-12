# Billing Web

`@comfyorg/billing-web` is the static Vue/Vite SPA for the hosted Comfy Cloud
billing experience.

## Current scope

This package contains the application shell, routing, localization, test/build
tooling, and the hosted top-up presentation. The top-up component owns amount
selection, credit conversion, purchase limits, and an `amountCents` checkout
event. It does not contain:

- a server runtime or BFF
- authentication or credential handling
- Billing API calls
- Billing SDK command or operation state wiring
- production deployment configuration

The checkout action stays disabled in the hosted shell until Account/Auth and
Billing SDK integration lands. Billing data, commands, and operation state must
come from `@comfyorg/account/billing`; the billing backend remains owned by the
Cloud repository.

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
The hosted entry remains disabled until the server flag is enabled or a
developer opts in from the browser console:

```javascript
localStorage.setItem('ff:hosted_billing_web_enabled', 'true')
```

Reload the Cloud frontend after changing the override. Existing Subscribe,
Resubscribe, and embedded-checkout actions remain in the core frontend until
the hosted app reaches feature parity.
