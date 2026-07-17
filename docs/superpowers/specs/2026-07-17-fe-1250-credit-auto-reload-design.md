# FE-1250 Credit Auto-Reload UI Design

## Objective

Ship the credit auto-reload settings UI with exact visual and interaction
parity to Alex's focused prototype while keeping the current billing
experience immediately recoverable through `billing_control_enabled`.
Production persistence and automatic charge enforcement are a separate backend
integration because no auto-reload API exists in the current frontend schema.

## Source precedence

1. Prototype PRs #13592 and #13487 for component markup, Tailwind classes,
   copy, and interactions.
2. `team-billing-wiki` for later permission, lifecycle, and responsive
   decisions.
3. Figma for variation comparison; prototype code remains the CSS source of
   truth.

## Architecture

- Mount `AutoReloadSection` in `SubscriptionPanelContentWorkspace` after the
  plan card and before the existing details/footer controls.
- Gate the mount with both `flags.billingControlEnabled` and
  `permissions.canManageSubscription`. When the flag is false, no new
  component or state is mounted and the existing billing UX is unchanged.
- Freeze the section when the billing status is `paused` or the team plan has
  lapsed. Frozen content is dimmed, reports Disabled, and cannot receive input.
- Keep the prototype's `useAutoReload` composable as the typed frontend wiring
  seam. It starts unconfigured and intentionally does not claim persistence.
  A later backend adapter can replace its in-memory mutations without changing
  the presentation components.
- Open the setup/edit surface through `dialogService`, using the existing
  headless Reka workspace-dialog chrome.
- Add the prototype's Reka `Switch` primitive and story because current `main`
  does not yet contain that dependency from the prototype stack.

## UI and states

The section and dialog retain the prototype markup and design tokens. Supported
visible states are:

- not configured;
- enabled without a monthly budget;
- enabled with a healthy budget;
- near limit, with amber percentage text;
- budget exhausted, with red percentage text and a Paused badge;
- configured but Off, with the inner tile dimmed;
- subscription paused or lapsed, with the entire section frozen;
- payment at risk, represented only by the existing shared billing banner;
- member access, where the section is absent.

The dialog supports credit/USD units, positive whole-credit threshold and
reload values, an optional positive monthly budget, the prototype's minimum
reload validation, approximate conversions, and the number of full reloads
allowed by the budget. Removing a budget keeps auto-reload enabled.

The section uses the prototype's container-query breakpoint. The integration
container supplies `@container`, preserving the stacked narrow layout and the
two-column wide layout without tying it to the viewport.

## Backend boundary

Current generated APIs support one-time top-up only. They do not expose
auto-reload settings CRUD, enabled state, monthly spend/reset data, or the
automatic trigger/charge/grant workflow. FE-1250 therefore does not add fake
network persistence, local-storage persistence, production mock pricing, or the
prototype billing harness. Those missing capabilities are documented in a
separate BE/integration ticket and do not block visual delivery.

## Verification

- Component tests cover every section state and setup/edit behavior.
- Integration tests cover flag on/off, owner/member permissions, and frozen
  lifecycle routing.
- Dialog tests cover unit switching, optional budget behavior, validation, and
  save/cancel.
- Typecheck, lint, formatting, knip, and focused unit tests must pass.
- After the PR preview is available, capture every visible variation from the
  same authenticated Chrome/CDP session and embed the evidence in the PR
  description.

## Non-goals

- FE-1248 payment-method management.
- Production settings persistence or optimistic/error behavior without an API.
- Server-side threshold monitoring, idempotent charging, credit grants, budget
  enforcement, or monthly reset rules.
- The do-not-merge billing mock harness or scenario query parameters.
