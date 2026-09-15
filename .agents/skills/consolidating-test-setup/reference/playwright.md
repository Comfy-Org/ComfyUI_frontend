# Playwright setup consolidation

Use this reference for Playwright and similar browser-test runners.

## Read first

Read the Playwright configuration, global setup and teardown, affected fixtures,
and canonical browser-test guidance. In this repository, inspect:

- `playwright.config.ts`
- `browser_tests/globalSetup.ts` and `browser_tests/globalTeardown.ts`
- the fixtures used by the affected specs
- `docs/guidance/playwright.md`
- `.agents/checks/playwright-e2e.md`
- `browser_tests/README.md`

Read fixture code directly. Do not guess its setup order or cleanup guarantees.

## Map the lifetime

Browser tests span the run, worker, browser context, page, application session,
and external services. Put state at the narrowest boundary that matches its real
lifetime.

Reserve run-wide hooks for run-wide resources. Worker fixtures must own isolated
worker resources. Keep mutable test state test-scoped unless broader ownership
is proven safe under parallel execution.

## Give fixtures full ownership

Use composable fixtures for resources that need setup and teardown. The fixture
that creates or mutates a resource must restore or release it after the handoff,
including when the test fails.

Keep roles separate:

- fixtures own lifecycle and resources
- page objects own locators and interactions for one UI area
- helpers coordinate domain actions
- data fixtures contain data, not runner behavior

Compose fixtures instead of growing a central page object or adding unrelated
global hooks.

## Preserve ordering

Install configuration, request interception, identity, and initial state before
the navigation that consumes them. Resolving a high-level fixture may navigate
before a hook body runs. Read the dependency graph and use fixture options or a
lower-level dependency for pre-navigation setup.

Do not boot the application and then repair state that should have existed at
startup.

## Account for external state

Assume parallel execution and fresh workers on retry. Resource identities must
not collide. Cleanup must affect only resources owned by that test or worker.

Resetting a page or context does not clean backend state or other external
resources. Define the complete boundary. Use opt-in cleanup when a universal
reset would erase persistence that a test needs to verify.

Retries expose pollution and readiness problems; they do not solve them.

## Preserve readiness guarantees

A fixture should hand control to the test only after observable readiness. Do
not centralize arbitrary delays or timing assumptions that belong to one suite.

Check history before removing waits, resets, or teardown. Preserve any race or
regression guarantee.

## Migrate and prove

For one lifecycle responsibility at a time:

1. Map fixture dependencies and external resources.
2. Identify setup required before navigation.
3. Test whether repeated local setup is necessary.
4. Choose test, worker, or run scope from the resource lifetime.
5. Put guaranteed cleanup in the owning fixture.
6. Keep opt-outs for tests that depend on retained state.

Run affected specs first. Repeat them and exercise parallel execution when
pollution or timing is plausible. Verify failure cleanup for external resources.
Then run the complete relevant browser suite and static checks. Inspect flaky or
retried outcomes instead of relying on the final green status.
