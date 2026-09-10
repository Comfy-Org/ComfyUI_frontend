# Billing Web

`@comfyorg/billing-web` is the static Vue/Vite SPA for the hosted Comfy Cloud
billing experience.

## Current scope

This package contains only the application shell, routing, localization, and
test/build tooling. It does not contain:

- a server runtime or BFF
- authentication or credential handling
- Billing API calls
- payment state management
- production deployment configuration

Account/Auth SDK and Billing SDK contracts must be agreed before those
integrations are added. The billing backend remains owned by the Cloud
repository.

## Commands

Run these commands from the repository root:

```bash
pnpm --filter @comfyorg/billing-web dev
pnpm --filter @comfyorg/billing-web typecheck
pnpm --filter @comfyorg/billing-web test:unit
pnpm --filter @comfyorg/billing-web build
```
