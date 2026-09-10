# ADR-BILLING-WEB-0031: Static SPA Boundary for Hosted Billing

Date: 2026-09-10

## Status

Proposed

## Context

Comfy Cloud needs a browser-hosted billing experience that can evolve
independently from the core ComfyUI application. The frontend repository is
already a pnpm workspace monorepo, while billing APIs and business logic are
owned by the Cloud repository.

Authentication and Billing SDK contracts are still under discussion. Committing
the hosted app to a frontend server runtime now would introduce a second backend
boundary before there is a concrete server-side responsibility for it.

## Decision

Create `apps/billing-web` as a Vue 3, Vite, and TypeScript workspace package.
The build output is a static SPA:

- There is no Nuxt layer, BFF, frontend service, or server function.
- The app uses shared design-system assets from the monorepo.
- Client-side routing owns browser navigation.
- Authentication and billing integrations are deferred until their SDK
  contracts are agreed.
- The Cloud repository continues to own billing APIs, authorization, and
  business logic.
- The core frontend opens the environment-specific billing URL in a separate
  tab behind the `hosted_billing_web_enabled` feature flag. It does not embed
  or import the hosted app.

The first scaffold deliberately does not guess the future SDK interfaces or
credential lifecycle. Integration code must follow
[ADR-AUTH-CREDENTIALS-0011](AUTH-CREDENTIALS-0011-cloud-credential-lifecycle-invariants.md)
and consume authoritative SDK or generated API types once they exist.

The hosting provider is not selected by this decision. Viable deployment
options remain:

1. A static Vercel project with SPA rewrites.
2. A dedicated static asset image served by GCS, nginx, or GKE.
3. A path-mounted build served under `cloud.comfy.org/billing`.

Each option must serve `index.html` for client-side routes, configure security
headers, and keep environment-specific values in build configuration rather
than source. The default build targets an origin root. A path-mounted deployment
must build with the matching Vite base (for example,
`vite build --base=/billing/`); the router derives its history base from the
same generated `BASE_URL`.

Alternatives considered:

- **Nuxt or another SSR framework.** Rejected for the initial application
  because no rendering, session, or server-only data requirement has been
  identified.
- **A frontend BFF.** Rejected until a concrete orchestration or
  credential-isolation requirement cannot be met by the Cloud API and SDKs.
- **Adding the page to the core application source tree.** Rejected because it
  couples billing deployment and release cadence to the editor application.
- **A separate repository.** Rejected because the existing pnpm workspace
  already provides shared tooling and design-system dependencies.

## Consequences

### Positive

- The app can be built, tested, and previewed before production integrations
  are ready.
- Static hosting keeps the runtime and operational surface small.
- Backend ownership remains explicit and no Cloud service is duplicated in the
  frontend repository.
- The package can consume shared workspace packages without publishing them
  first.

### Negative

- Client-side routing requires a host-level fallback to `index.html`.
- A provider-specific deployment configuration and domain mapping still need a
  separate decision.
- Production activation is blocked on agreed authentication and Billing SDK
  contracts.
- If future requirements need server-only secrets or orchestration, the static
  boundary must be revisited rather than hiding those responsibilities in the
  SPA.
