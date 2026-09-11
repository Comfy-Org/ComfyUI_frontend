# Cloud billing E2E coverage proposal

Status: Draft for scope review. This document adds no executable tests or CI gate.

## Problem and current coverage

A no-card customer who did not finish hosted Stripe Checkout reached a
verification timeout and repeated same-plan 409 responses. Investigation also
found that backend timeout cleanup could leave `billing_status` at
`awaiting_payment_method` after the checkout operation ended.
Sources: [incident thread](https://comfy-organization.slack.com/archives/C0BNGQG2LCW/p1789104046181919)
and [backend investigation](https://comfy-organization.slack.com/archives/C0BNGQG2LCW/p1789107331270719).

The existing [checkout recovery spec](../../browser_tests/tests/dialogs/checkoutRecovery.spec.ts)
seeds pending checkout state and mocks billing responses. It covers frontend
reconciliation behavior, but cannot establish that a real subscription, billing
operation, and workspace converge after Stripe and Temporal finish.

The [backend timeout fix](https://github.com/Comfy-Org/cloud/pull/8978) merged on
2026-09-11. Deployment and cleanup of the existing cohort are separate evidence
requirements; this proposal does not establish either one.

## Scope and owners

The [thread confirms E2E as ShihChi's scope](https://comfy-organization.slack.com/archives/C0BNGQG2LCW/p1789164154382169),
with [Anupreet's confirmation](https://comfy-organization.slack.com/archives/C0BNGQG2LCW/p1789165368584359).
The additional assignments below remain open for review.

| Work                                                                       | Owner / status                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| FE to Cloud backend E2E coverage                                           | ShihChi; implementation scope proposed below                                                           |
| Backend billing design plan                                                | Luke with Wei, per thread                                                                              |
| Dashboard and monitor updates                                              | Luke, per [his reply](https://comfy-organization.slack.com/archives/C0BNGQG2LCW/p1789146868800469)     |
| FE resume/retry behavior and timeout telemetry implementation              | Owner and tracking issue to confirm                                                                    |
| Sandbox identity, Stripe configuration, state inspection, and test cleanup | Backend partner to confirm with Luke                                                                   |
| Existing stranded workspace cleanup                                        | Track [BE-12602](https://linear.app/comfyorg/issue/BE-12602); confirm executor and completion evidence |
| CI failures and release decision                                           | ShihChi proposes test triage; release owner and escalation path to confirm                             |

## First executable slice

Use a candidate frontend with a real Cloud test backend and Stripe test mode.
Start with personal, no-card, classic hosted checkout (`embedded_checkout=false`),
the path reported in the incident. Exercise the actual Subscribe click, preview
request, displayed preview, confirmed write, and resulting operation.

Do not fulfill billing/auth requests with fixtures, inject a pending checkout
record, or seed a completed subscription to satisfy these scenarios. Setup may
provision an isolated test identity and empty workspace through an agreed backend
test interface. Existing mocked tests continue to provide fast frontend feedback.

| Scenario                    | Browser assertion                                                                                                    | Authoritative state assertion                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete payment            | Subscribe opens the hosted payment flow; successful payment returns to a usable subscribed UI                        | Operation succeeds, subscription is active, workspace is `paid`; exactly one subscription/payment for the attempt                           |
| Abandon, return, resume     | Close Checkout before payment, return or reload the app, and use a visible action to reopen the pending payment flow | Attempt remains resumable while pending; eventual payment converges to the successful state above                                           |
| Retry the same plan         | Repeated Subscribe attempts lead to a usable pending checkout or an actionable recovery path                         | No duplicate subscription/payment; a conflict response must not strand the user                                                             |
| Expire an abandoned attempt | After backend expiry, return and subscribe again without a permanent verification spinner                            | Original op is terminal, reserved subscription ended, workspace `inactive` for this no-other-subscription fixture; a fresh attempt succeeds |
| Popup blocked               | Payment action remains accessible when the browser blocks automatic opening                                          | Existing operation can still complete through that action without a duplicate attempt                                                       |

The browser polling deadline and the backend payment-method wait are different
timeouts. Moving the browser clock does not advance Temporal. Verify the backend
timeout branch using Temporal's workflow test clock and full terminal-state
assertions; a live timeout journey additionally needs an agreed non-production
expiry mechanism that exercises the same timeout branch. An abandonment signal
alone does not prove the timer branch. Until that mechanism exists, mark the live
timeout row blocked and retain the backend regression test as separate evidence.

Follow with saved-card, payment failure, delayed webhook, cross-workspace/user
recovery isolation, and supported embedded-checkout cases. Record the tested
billing rail and feature flags; a hosted-flow pass does not cover embedded checkout.

## Environment and lifecycle contract to agree before implementation

- Select the exact test frontend/backend deployment and verify Stripe test mode
  before creating a checkout. Record expected and served frontend SHA, backend
  revision, billing rail, and effective feature flags for each run.
- Provide real browser authentication for a dedicated test identity, plus a fresh
  workspace/customer with no card, active subscription, or pending operation.
  Use a per-run identity or exclusive lease so parallel runs cannot share billing
  state. Define how expired credentials fail setup.
- Provide a supported readback for operation, subscription, workspace status, and
  Stripe payment/session IDs. UI success alone is insufficient. Verify the fixture
  starts clean before driving the user flow.
- Define bounded readiness deadlines for webhook delivery and state convergence.
  Fail with the last observed state when exceeded; do not add fixed sleeps or
  turn missing setup into a skipped passing test.
- Run cleanup even after failure. Cancel test subscriptions and expire remaining
  sessions/operations through supported test mechanisms, then verify cleanup.
  Cleanup failure fails the run and prevents reuse of the fixture.
- Preserve browser traces and redacted request/state evidence. Keep auth tokens,
  payment links, and customer data out of public artifacts.

## CI and release criteria (proposed, not enabled)

1. Start with an explicitly triggered sandbox run against a recorded FE/BE pair.
   Prove the test fails on a known-broken recovery or teardown implementation and
   passes on the fixed pair before treating it as regression protection.
2. Run the successful payment and abandon/resume/retry cases for billing changes
   in both repositories and before promoting a Cloud release candidate. Add a
   scheduled run for deployed integration drift. Agree the shared trigger and
   check owner before making it required.
3. Require a successful result for the exact candidate and flags being promoted.
   Scenario failures, setup failures, skipped required cases, missing evidence,
   and cleanup failures cannot authorize promotion. Record retries separately so
   a pass after failure remains visible for triage.
4. Keep timeout workflow proof and any blocked live scenario explicit in the
   result. A narrower smoke pass must not be reported as full matrix completion.

## Observability and rollout completion

Luke's monitoring work should independently verify ingestion and alerting for
stuck operations and workspace drift. Frontend event emission and actual RUM
ingestion need separate checks. Confirm whether `billing.operation.timeout` is
the agreed event contract before adding an assertion; a sampled-out session must
not become a flaky payment-test assertion.

The gap is closed when the agreed matrix has executable tests, a recorded live
pass and known-bad rejection, a functioning CI/release gate, and a named failure
owner. Separately track the FE recovery fix, backend deployment, monitoring, and
BE-12602 cleanup with their own completion evidence. Merging this plan completes
none of those implementation or rollout steps.
