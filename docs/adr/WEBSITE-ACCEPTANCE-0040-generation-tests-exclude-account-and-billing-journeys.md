# ADR-WEBSITE-ACCEPTANCE-0040: Generation tests exclude account and billing journeys

Date: 2026-09-23

## Status

Accepted

Supersedes [WEBSITE-ACCEPTANCE-0036](WEBSITE-ACCEPTANCE-0036-separate-live-customer-tests-from-offline-ci.md).

## Context

The first live suite coupled generation to signup, sandbox checkout and a
manually configured charge for each page/input variant. Provider prices change,
and usage-based prices cannot be represented reliably by fixed per-test amounts.
Those dependencies prevented generation checks from running with the available
API key and existing account credentials. The requested scope is generation;
account and billing behavior belong to their own suites.

## Decision

Retain separate offline PR and live generation runners. Remove signup/checkout
scenarios and exact balance assertions from the Workshop generation suite.
Do not infer an expected price from the charge being tested or scrape UI prices.
Keep real uploads, jobs, idempotency evidence, media playback and decoding.

Treat login as a worker-scoped prerequisite. Reuse an in-memory authenticated
storage snapshot while giving each generation test a fresh browser context.
Retain the Router API key for catalogue sweeps and browser-origin upload probes;
website session setup uses the existing account's email/password. Do not assume
an API key can be exchanged for a browser session.

## Alternatives

- A manually refreshed price table creates a second pricing source and remains
  invalid for usage-dependent output costs.
- Learning prices from the first run makes the billing expectation circular.
- Mocking the generation response would lose the live provider/output coverage.
- Repeating sign-in and checkout per model multiplies unrelated failure causes.

## Consequences

Only three production secrets are required. There is no payment sandbox or
expected-price configuration in these workflows. Generation still spends real
credits and requires funded accounts. A successful run does not certify auth,
payment settlement, exact charges or the full golden-path QA release gate.
Those claims require the account/billing suites and their own execution evidence.

## References

- [Generation runbook and QA mapping](../../apps/website/acceptance/README.md)
- [Golden-path QA plan](https://app.notion.com/p/3e26d73d3650812c9b01f0b7ea21d70e)
