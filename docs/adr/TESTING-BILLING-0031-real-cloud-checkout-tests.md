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

Use a dedicated no-card account and the public billing API. Establish the
connection with a sign-in and billing-read smoke test. Checkout recovery
scenarios build on this harness in a separate change: abandon the unpaid Stripe
checkout and verify retry, reload, and fresh sign-in reuse the pending operation.

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
- Recovery tests leave unpaid checkout operations pending. Sequential runs can
  resume them, but concurrent tests against the same workspace must be avoided.
- Payment completion, timeout behavior, and a release gate remain follow-up work.

## Notes

See the [run instructions](../testing/cloud-billing-e2e.md).
