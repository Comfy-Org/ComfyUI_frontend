# ADR-TESTING-BILLING-0031: Real Cloud Checkout Tests

Date: 2026-09-11

## Status

Proposed

## Context

Mocked checkout responses cannot detect disagreement between the frontend,
Cloud billing operations, and Stripe. The abandoned no-card checkout incident
requires an integration regression test, while ordinary browser CI must remain
independent of real billing credentials and mutable customer state.

## Decision

Use a separate, explicitly invoked Playwright configuration for real Cloud billing
tests. Reuse the Comfy page object and network guard, but replace the mock-based
Cloud setup with real authenticated browser storage and an exact sandbox origin
allowlist. Keep these tests out of ordinary browser test collection.

Require a dedicated personal workspace and an idempotent backend-owned reset
executable. The frontend repository owns browser assertions and reads billing state
through the public API; it does not embed database writes or Temporal admin logic.
Reset runs before and after the test, and failure prevents reuse of the fixture.
The reset implementation remains a prerequisite for live validation.

Retain mocked tests for fast frontend feedback. Extending them alone was rejected
because supplied responses cannot expose a broken backend contract. Reusing a
shared customer without reset was rejected because a failed run would change the
next run's preconditions. Hardcoding backend admin cleanup here was rejected
because the backend owns subscription and workflow lifecycle rules.

## Consequences

### Positive

- Real Subscribe responses and pending operations can expose integration failures.
- Ordinary CI does not gain a dependency on billing credentials or Stripe.
- The backend can implement cleanup without duplicating lifecycle rules in tests.

### Negative

- Sandbox auth, reset implementation, and cross-run workspace exclusion must be
  provisioned before execution; the draft cannot claim live coverage yet.
- The first recovery test does not cover payment completion or Temporal expiry.
- A required cross-repository release gate remains follow-up work.

## Notes

See the [scenario matrix and run instructions](../testing/cloud-billing-e2e.md)
and [scope discussion](https://comfy-organization.slack.com/archives/C0BNGQG2LCW/p1789164154382169).
