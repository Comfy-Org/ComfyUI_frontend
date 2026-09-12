# ADR-TESTING-BILLING-0031: Real Cloud Checkout Tests

Date: 2026-09-11

## Status

Proposed

## Context

Mocked responses cannot detect disagreement between the frontend, Cloud billing,
and Stripe. The first regression test must exercise the browser against a real
sandbox without requiring backend administrator credentials.

## Decision

Add an explicitly enabled `cloud-live` project to the existing Playwright runner.
Reuse `.env`, frontend/backend URL conventions, and ComfyPage. Sign in through the
real UI and capture post-login screenshots. Keep normal browser CI independent of
sandbox credentials.

Use a dedicated no-card account and the public billing API. Close the unpaid
Stripe checkout, resume payment, and assert that the same billing operation is
reused. Record the pending operation instead of resetting backend state.

A separate JSON configuration and an external reset executable add unnecessary
setup. Embedding database writes and Stripe/Temporal administration in the fixture
also makes browser coverage depend on privileged access and backend internals.
Those approaches are rejected for this test. Backend reset and expiry verification
can be added separately when required for repeatable CI.

## Consequences

### Positive

- The browser test requires only sandbox URLs and account credentials.
- No payment is submitted and no backend billing state is reset.

### Negative

- Unpaid operations can remain pending after a run. Account reuse depends on the
  backend's ability to resume that state, and concurrent runs must be avoided.
- Cleanup is not a substitute for an assertion about product recovery.
- Payment completion, reload recovery, timeout behavior, and a release gate remain
  follow-up work.

## Notes

See the [run instructions](../testing/cloud-billing-e2e.md).
