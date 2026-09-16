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
  tab when the server's `hosted_billing_destination` feature flag resolves to
  `billing_web` (the flag's other variant, `stripe`, keeps the provider page;
  anything else normalizes to `stripe`). It does not embed or import the
  hosted app. The flag initially only redirects the Plans & pricing navigation
  item; transactional Subscribe, Resubscribe, and embedded-checkout actions
  remain in the core frontend until the hosted app reaches parity.

The first scaffold deliberately does not guess the future SDK interfaces or
credential lifecycle. Integration code must follow
[ADR-AUTH-CREDENTIALS-0011](AUTH-CREDENTIALS-0011-cloud-credential-lifecycle-invariants.md)
and consume authoritative SDK or generated API types once they exist.

Host the MVP on a static Vercel project with SPA rewrites, and move to
self-hosted nginx once the hosted app carries production billing traffic.

Vercel is the MVP host because the repository already deploys `apps/website`
that way, so the preview-per-pull-request and production-on-merge pipeline is a
known quantity and needs no new infrastructure to review the app. The
configuration lives in `apps/billing-web/vercel.json` and
`.github/workflows/ci-vercel-billing-web-preview.yaml`.

Self-hosted nginx is the long-term host because billing is a payment surface:
its availability, egress path, request logs, and security headers should sit
under the same operational control as the rest of Comfy Cloud rather than
behind a third-party edge. The target is a static asset image served by nginx
alongside the existing Cloud infrastructure.

The two hosts are interchangeable because the artifact is a directory of static
files. Any host of it must serve `index.html` for client-side routes, return a
genuine 404 for a file request that misses (a blanket rewrite that answers a
missing asset with the HTML shell turns a stale chunk into a blank page rather
than a visible failure), set security headers, and keep environment-specific
values in build configuration rather than source. Nothing may depend on a
Vercel-specific primitive: no edge middleware, no serverless function, no
provider-managed redirect that is not reproducible as an nginx rule.

The default build targets an origin root. A path-mounted deployment, such as
`cloud.comfy.org/billing` under the Cloud ingress, must build with the matching
Vite base (for example, `vite build --base=/billing/`); the router derives its
history base from the same generated `BASE_URL`. That remains available to the
nginx migration without a further decision.

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
- **Self-hosted nginx from the start.** Rejected for the MVP because it blocks
  the first reviewable deployment on infrastructure work that the static
  artifact does not yet justify. It remains the destination, not a discarded
  option.

## Consequences

### Positive

- The app can be built, tested, and previewed before production integrations
  are ready.
- Static hosting keeps the runtime and operational surface small.
- The MVP host is replaceable. Choosing Vercel now costs a configuration file
  and a workflow, not an architectural dependency.
- Backend ownership remains explicit and no Cloud service is duplicated in the
  frontend repository.
- The package can consume shared workspace packages without publishing them
  first.

### Negative

- Client-side routing requires a host-level fallback to `index.html`.
- Two hosting configurations exist over the app's lifetime, and the migration
  to nginx must re-establish the rewrite, header, and caching behavior that
  `vercel.json` expresses declaratively.
- A custom domain is a separate step. `comfy.org` DNS is on Cloudflare, so a
  `billing.comfy.org` record is owned outside this repository; until it exists
  the deployment is reachable at its provider-assigned host.
- Production activation is blocked on agreed authentication and Billing SDK
  contracts.
- If future requirements need server-only secrets or orchestration, the static
  boundary must be revisited rather than hiding those responsibilities in the
  SPA.
