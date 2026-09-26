# ADR-WEBSITE-ACCEPTANCE-0036: Separate live customer acceptance from offline CI

Date: 2026-09-21

## Status

Superseded by [WEBSITE-ACCEPTANCE-0040](WEBSITE-ACCEPTANCE-0040-generation-tests-exclude-account-and-billing-journeys.md).

## Context

The Workshop golden-path QA plan requires real provider execution, browser
uploads, payment settlement, and usable results. Existing website browser tests
intentionally forbid external requests. Cloud's SDK suite proves different
boundaries and cannot certify the website's authentication, forms, or CORS.

## Decision

Keep the offline website suite unchanged and give live acceptance its own
Playwright configuration. Execute it on GitHub-hosted runners against deployed
services. Restrict production jobs to trusted main-branch schedules, completed
production deployments, and manual dispatches. Keep checkout acceptance in the
payment sandbox and require a test-mode checkout session before entering card
details. Never interpret missing credentials as a successful skip.

Retain the existing Node model runner for broad catalogue coverage. Use browser
acceptance for representative customer journeys that the Node runner cannot
prove. Serialize workflows sharing a paid environment; automatic retries must
not create additional paid jobs. Review billing expectations independently of
the system under test and use isolated customer accounts for balance deltas.

Rejected alternatives were enabling external calls in the PR fixture, putting
real purchases in production smoke, and treating the SDK or Node generation
grid as browser acceptance. These respectively mix trusted credentials with PR
execution, create recurring financial side effects unrelated to generation
availability, and leave the customer-facing integration untested. A dedicated
GPU runner is unnecessary because providers perform generation remotely.

## Consequences

### Positive

- PR checks stay deterministic and free of provider charges.
- The same Actions interface exposes deployment smoke, catalogue sweeps, and
  release acceptance under one Workshop prefix.
- Reports distinguish successful decoding from outstanding human quality review.

### Negative

- Dedicated accounts, reviewed prices, a payment sandbox, and funding need owners.
- Serial execution can delay smoke behind a long catalogue sweep.
- Balance deltas require account isolation and do not replace per-job ledger tests.
- Browser emulation and representative pages do not certify every device or
  every catalogue page's custom inputs.

## Notes

- [Golden-path QA plan](https://app.notion.com/p/comfy-org/Workshop-Models-Golden-Paths-QA-Test-Cases-3e26d73d3650812c9b01f0b7ea21d70e)
- [Operational setup and coverage boundary](../../apps/website/acceptance/README.md)
