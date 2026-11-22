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

Use a dedicated sandbox account and the public billing API. Establish the
connection with a sign-in and billing-read smoke test. Checkout recovery
scenarios build on this harness in a separate change.

A separate JSON configuration and an external reset executable add unnecessary
setup. Embedding database writes and Stripe/Temporal administration in the fixture
also makes browser coverage depend on privileged access and backend internals.
Those approaches are rejected for this test. Backend reset and expiry verification
can be added separately when required for repeatable CI.

## Consequences

### Positive

- The browser test requires only sandbox URLs and account credentials.
- The smoke test neither submits payment nor resets billing state.

### Negative

- Live validation requires a dedicated sandbox account and a running frontend.
- The smoke test establishes authentication and billing reads, not checkout
  correctness. Recovery and payment scenarios require additional coverage.

## Notes

See the [run instructions](../testing/cloud-billing-e2e.md).
