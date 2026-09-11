# ADR-BILLING-CHECKOUT-0031: Checkout Journey Instrumentation Contract

Date: 2026-09-09

## Status

Proposed

## Context

The embedded-checkout rollout replaces the hosted Stripe redirect (control)
with an in-app Payment Element (treatment), gated by the fail-closed boolean
server feature `embedded_checked_enabled`. To compare the two arms fairly we
need observable, correlated checkout journeys, but the existing billing
telemetry only records terminal business outcomes
(`billing.<operation>.started|succeeded|failed|timeout`). Those events cannot
answer where a journey stalled (preview, card entry, submission), cannot tell a
resolved `control` from an unknown assignment, and rotate their only stable
identifier — `billing_op_id`, minted by the backend — on retry.

Two existing utilities own fragments of this state and neither is sufficient
alone:

- `subscriptionCheckoutTracker` — a personal-tier `attempt_id` in
  `localStorage` (6h). Excludes team and top-up.
- `pendingSubscriptionCheckout` — a server `operationId` in `sessionStorage`
  (24h) for polling recovery. Only exists once the initiating request succeeds.

ADR-AUTH-BILLING-0014 (Proposed) already argues for a rail-neutral _attempt
context_ (`billing_attempt_id` + `workspace_id`) captured before the first
`await` and handed to `startOperation()`. That decision is not yet implemented.
This ADR ratifies the wider _journey_ contract the rollout dashboard consumes
and is realized by the same PR (commits FE-02/FE-03), superseding nothing but
extending 0014's attempt context with a durable, arm-frozen journey identity.

## Decision

### 1. A dedicated journey event union, separate from terminal outcomes

Intermediate lifecycle stages are modelled as a `CheckoutJourneyTelemetryEvent`
discriminated union on `phase`, emitted as `billing.checkout.<phase>`, kept
deliberately separate from the `BillingTelemetryEvent` terminal taxonomy. A
client observation of progress (preview ready, element mounted, token created)
must never be readable as a business success/failure/timeout. Phases:

| Event                                       | Emission boundary                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `billing.checkout.entered`                  | Once at eligible intent, before preview, card collection, or arm-specific work |
| `billing.checkout.preview_ready`            | A successful quote accepted into usable UI, once per accepted revision         |
| `billing.checkout.preview_failed`           | Preview cannot become usable; sanitized category/code + revision identity      |
| `billing.checkout.payment_element_ready`    | Stripe element readiness callback for the current live mount                   |
| `billing.checkout.payment_element_failed`   | SDK init, mount/load, or config-update failure; phase-distinguished            |
| `billing.checkout.payment_submit_attempted` | Submission passes local busy/eligibility guards, before Elements validation    |
| `billing.checkout.payment_submit_failed`    | Elements validation or token-creation failure; phase-distinguished             |
| `billing.checkout.submitted`                | Immediately before the checkout API request, after any token creation          |
| `billing.checkout.operation_linked`         | Response or validated recovery binds the journey to an operation ID            |

Every event carries a frozen `CheckoutJourneyContext`: `checkout_journey_id`,
`checkout_entered_at` (UTC), `assignment_status`, optional `assigned_arm`,
`entry_flow`, `entry_source`, and optional `ui_mode`/`billing_op_id`.
`ui_mode` records the checkout UI the user actually saw (`embedded`/`hosted`),
so a frozen arm can be reconciled against real experience. `schema_version` is
stamped on every payload. Correlation rides on `checkout_journey_id` (all
events) and `billing_op_id` (from `operation_linked` onward, the join to the
terminal `billing.*` taxonomy), plus each provider's own native event id
(PostHog event UUID, Datadog RUM `action.id`); the dispatcher does not mint a
redundant shared id.

### 2. Assignment is frozen from the server response, never fabricated

The arm is derived once, at entry, from the presence and value of
`embedded_checked_enabled` in the server feature payload:

- key present, `true` → `assignment_status: resolved`, `assigned_arm: treatment`
- key present, non-`true` → `resolved`, `assigned_arm: control`
- key absent → `assignment_status: unavailable`, **`assigned_arm` omitted**

An unknown assignment never masquerades as a resolved `control`. The UI keeps
its current fail-closed behaviour; a later flag refresh changes observed
behaviour but not the frozen assignment. Checkout is never blocked waiting on
flag or identity resolution.

### 3. Journey scope and lifecycle transitions

A journey is one authenticated actor, one workspace, and one intended purchase.
Persistence is per-tab `sessionStorage` (24h), surviving reload. The lifecycle
owner exposes three named transitions:

| Transition | Rule                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| **resume** | Same actor, workspace, and `entry_flow`, unexpired → reuse the stored record (no new entry)              |
| **create** | No record, or a changed actor / workspace / entry flow, or expired → discard stale, mint a fresh journey |
| **end**    | Terminal outcome or explicit clear removes the record                                                    |

UI remount is not an entry. A changed sign-in or workspace switch cannot inherit
the previous context. Finer intent boundaries within a rail (tier change, top-up
amount change) are enforced by the calling composable choosing to start a fresh
journey; the owner enforces the actor/workspace/flow boundary. Stale or corrupt
storage is discarded safely and legacy records without journey metadata are
treated as unknown, never assigned retroactively.

Storage is a single per-tab slot, so two rails cannot hold independent journeys
at once. A journey already bound to an in-flight operation (`billing_op_id` set)
takes precedence: a differing rail's entry will not overwrite it, and a journey
binds to exactly one operation and is never rebound. The bound journey's poller
owns the terminal clear (gated on `billing_op_id`) until it resolves. During
such an overlap the second rail forgoes its own journey rather than corrupting
the first; full per-rail isolation is deferred.

### 4. Privacy

Never capture confirmation tokens, client secrets, card details, raw Stripe
payloads, action URLs, or unbounded error messages. Only reviewed error-code
allowlists and categorical metadata cross the wire. Error reporting reuses
`reportError()`; no raw Sentry/Datadog sinks and no user identifiers in URLs.

## Consequences

### Positive

- The dashboard can compare arms on one denominator (`checkout_journey_id`) and
  see where journeys stall, not just whether they ended.
- A resolved `control` is distinguishable from an unavailable assignment, so
  fail-closed fallbacks are not miscounted as intended control exposure.
- The journey identity survives reload and retry, and is rail-neutral, so the
  top-up rail and team paths correlate for free.
- Intermediate observations cannot be mistaken for business truth.

### Negative

- Client observations are not authoritative completion. Grant/outcome joins
  remain a backend/data integration (see below); the completion tile is not
  decision-ready until that owner verifies the joins.
- Per-tab `sessionStorage` does not share a journey across tabs; cross-tab
  operation recovery continues to rely on `pendingSubscriptionCheckout`.
- Finer intent boundaries are a caller responsibility, not enforced centrally.

## Notes

Backend/data handoffs this frontend work depends on but does not deliver:

| Dependency                                                                      | Owner         | Blocks                         |
| ------------------------------------------------------------------------------- | ------------- | ------------------------------ |
| Backend outcomes in PostHog (timestamped status + grant evidence, lag contract) | Billing/data  | Authoritative completion tiles |
| Durable correlation (retain attempt/journey join across retries)                | Billing       | Cross-system funnel            |
| Rollout stage source (effective-time allocation log)                            | Rollout/data  | Stage-separated enrollment     |
| Identity/flow mapping (UID convention, eligible scope, unknown-flow handling)   | Frontend/data | Valid denominators             |

Realized by this PR's FE-02 (`CheckoutJourneyTelemetryEvent` + provider
delivery) and FE-03 (`checkoutJourney` lifecycle owner). Emission wiring
(FE-04..FE-08) and the diagnostics follow-ups (FE-09/FE-10) build on this
contract.
