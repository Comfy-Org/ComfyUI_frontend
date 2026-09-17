# ADR-PACKAGES-ACCOUNT-UI-0034: Payment UI Belongs to the Shared Account UI Package

Date: 2026-09-17

## Status

Proposed

## Context

`@comfyorg/account-ui` is the only workspace package that ships Vue.
`@comfyorg/design-system` ships CSS custom properties and icons;
`@comfyorg/tailwind-utils` ships `cn()`. Neither exports a component. So
"move this component somewhere shared" has exactly one destination today,
and the question of what belongs there has never been answered in writing.

The package already spans both halves of the account layer. Its export map
splits `./auth/*` from `./billing`, its description names "the shared
operation lifecycle, payment projection and sign-in pieces", and three
consumers — the cloud app, `apps/website` and `apps/billing-web` — import
from both. A fourth is pending and is why the boundary is a distribution
question rather than only a layout one: the Platform product consumes these
packages from npm rather than from this workspace, so whatever the package
exports becomes an external contract. That arrangement is real but
undocumented: `docs/` contains no mention of the package. What stands in for
a boundary is the header comment on
`packages/account-ui/src/billing/index.ts`, which draws the line to exclude
the provider SDK:

> routing, windows, dialogs, the payment provider's SDK, and styling all
> stay with the host.

The forcing case is hosted billing. `apps/billing-web` renders `/v1/checkout`
as a static mock with `checkout-enabled` false. The working flow is
`src/platform/workspace/components/UnifiedStripePaymentSelector.vue` — 383
lines that mount Stripe Elements, call `createConfirmationToken`, and hand
the token to `subscribe` for the lifecycle to drive through 3DS. That file
lives in the cloud app, which is the private root package
`@comfyorg/comfyui-frontend`: it declares no entry points and nothing depends
on it, so no specifier exists for `apps/billing-web` to import it by. Hosted
checkout is therefore a choice between promoting that component into a
workspace package and writing a second one.

ADR-AUTH-BILLING-0032 already rules out the second option for a neighbouring
case. Its rule 4 says further billing surfaces — naming embedded checkout —
"do not get a site-local implementation under it; they wait for the shared
command layer." The command layer has since landed. Nothing has said where
the view half of that shared layer lives, and the header quoted above says,
in the only place it is written down, that the provider-bound part of it
does not live in the package.

## Decision

1. **Payment presentation is in scope for `@comfyorg/account-ui`**,
   including the provider-bound pieces: mounting the card element, creating
   a confirmation token, and presenting the authentication challenge. A
   payment surface that more than one host renders belongs to the package
   rather than to whichever host built it first. That rule is stated for
   payment surfaces and is not extended here. Sign-in is duplicated on the
   same reasoning — `apps/website/src/components/auth/AuthSignIn.vue` and
   its Astro routes against the cloud app's own sign-in — and whether it
   reaches the same conclusion is settled separately, not by citing this
   sentence.

2. **The header contract changes with it.** "The payment provider's SDK
   stays with the host" stops being true and must be edited, not quietly
   contradicted. What stays with the host is routing, window strategy,
   dialogs, and styling.

3. **The provider SDK enters behind its own entry point.** Provider-bound
   components export from `./billing/stripe` rather than `./billing`, and
   `@stripe/stripe-js` is declared an optional peer dependency, so a
   consumer wanting only the composables does not take on the provider. No
   host has yet stated a requirement either way; this is the reversible
   choice, because collapsing two entry points later is cheaper than
   splitting one that consumers already import.

4. **Promoted components take their host couplings as inputs.** The cloud
   app's `Button`, telemetry sink, and checkout-journey events arrive as a
   slot and a port, not as imports. The package stays unstyled and
   framework-free above Vue; a promotion that drags the design system in has
   not finished.

5. **Transport, commands and readers stay in `@comfyorg/account-core`.**
   This decision moves presentation only. It also does not make a surface
   shareable merely by moving it: state the frontend assembles from several
   server fields — `src/composables/billing/useNextInvoice.ts`, whose own
   docstring defers to "an authoritative upcoming-invoice amount" the
   backend does not yet expose — is not promoted. It is either replaced by a
   server-provided value or left where it is.

## Consequences

### Positive

- One checkout implementation serves the cloud app, `apps/billing-web`, and
  the Platform install, instead of one per host. Payment surfaces are where
  divergence is most expensive: a fix to 3DS handling that lands in one copy
  and not the other is a customer-visible difference in whether a card
  clears.
- ADR-AUTH-BILLING-0032's rule 4 gains the destination it assumed. "Wait for
  the shared layer" now names a package.
- The boundary stops being tribal knowledge recoverable only by reading an
  export map.

### Negative

- **`account-ui` needs a Vue-aware build it does not have.** The three SDK
  packages build with `tsc -p tsconfig.build.json`, which cannot emit
  `.vue`. `account-ui` has neither that file nor a Vite config, so making it
  publishable is new tooling — library-mode bundling plus `vue-tsc`
  declarations — rather than a copy of what #17882 did for the others. This
  is the main cost, and it is paid before the first promotion, not after.
- `@stripe/stripe-js` moves from the root catalog into a published package's
  dependency graph. Upgrading it stops being a repository decision and
  acquires consumer blast radius.
- The package's billing surface is one component and eight composables
  today. Provider UI is component-heavy, and every component added makes the
  unstyled promise in rule 4 harder to keep than it is to state.
- Rule 2 reverses a contract that is written down. Anyone who read that
  header and kept provider code in a host was following the documented rule,
  and is now holding code that belongs elsewhere.

## Notes

- ADR-AUTH-BILLING-0032 governs where billing _transport_ lives for
  `apps/website` and is unchanged by this: that boundary is about which
  module issues the request, this one about which package owns the view.
- ADR-RELEASES-PACKAGES-0033 governs how these packages version and publish.
  `account-ui` is outside its enumerated set today and joins it when the
  package goes public.
