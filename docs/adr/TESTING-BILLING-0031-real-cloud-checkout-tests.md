# ADR-TESTING-BILLING-0031: Real Cloud Checkout Tests

Date: 2026-09-11

## Status

Proposed

## Context

Mocked checkout responses cannot detect disagreement between the frontend,
Cloud billing operations, and Stripe. Ordinary browser CI must remain independent
of real billing credentials and mutable customer state.

## Decision

Add an explicitly enabled `cloud-live` project to the existing Playwright runner.
Reuse `.env`, frontend/backend URL conventions, and ComfyPage, replacing the
mock-based Cloud setup with real UI authentication. Capture post-login screenshots.

Use a dedicated inactive personal workspace. Reuse Cloud E2E account variables
and billing smoke database/Stripe variables. Bundle teardown with the fixture:
expire test-created Stripe sessions, signal the existing Temporal abandonment
path, verify terminal operations, and restore inactive billing with a projection
outbox event. Guard cleanup with workspace state checks and an advisory lock.

A separate JSON configuration and an unimplemented reset executable were rejected:
they add another setup contract without making the test runnable. Extending mocked
tests alone cannot expose a broken backend contract. A public-API-only reset is
not available for a pending checkout. Adding a new backend admin endpoint would
expand the first test's scope. The fixture therefore depends on existing privileged
sandbox interfaces, like Cloud's billing smoke tests.

## Consequences

- Normal browser test collection remains independent of sandbox credentials.
- Test setup can reject missing access before creating a billing operation.
- The frontend test now depends on backend schema and workflow cleanup contracts;
  changes to these contracts require updating this fixture.
- Cleanup is not a product recovery assertion and cannot count as timeout coverage.
- A dedicated identity and backend credentials remain required for live validation.
- Payment completion, reload recovery, timeout behavior, and a release gate remain
  follow-up work.

## Notes

See the [run instructions](../testing/cloud-billing-e2e.md) and
[scope discussion](https://comfy-organization.slack.com/archives/C0BNGQG2LCW/p1789164154382169).
