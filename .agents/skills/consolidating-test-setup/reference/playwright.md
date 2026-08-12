# Playwright Setup Consolidation

Read this reference only for Playwright or comparable browser-test runners.

## Sources of Truth

Read the Playwright configuration, global setup and teardown, fixture graph, and
canonical browser-test guidance. In this repository, start with:

- `playwright.config.ts`
- `browser_tests/globalSetup.ts` and `browser_tests/globalTeardown.ts`
- `browser_tests/fixtures/`, especially the fixtures used by affected specs
- `browser_tests/README.md`

Read fixture implementations directly instead of guessing their setup order or
cleanup guarantees.

## Lifecycle Model

Browser tests span several boundaries: run, worker, browser context, page,
application session, and external services. Place state at the narrowest
boundary matching its actual lifetime.

Run-wide hooks are only for genuinely run-wide resources. Worker fixtures must
own worker-isolated resources. Mutable test state should normally be test
scoped. A serial pass does not prove that a broader scope is safe.

## Fixture Ownership

Prefer composable Playwright fixtures for resources requiring setup and
teardown. The fixture that creates or mutates a resource must release or restore
it after the fixture handoff, including when the test fails.

Compose independent fixtures rather than expanding a central page object or
accumulating unrelated global hooks. Follow the repository's fixture-extension
and composition conventions.

Keep responsibilities distinct:

- fixtures own lifecycle and resources
- page objects own locators and interaction with one UI surface
- helpers coordinate domain actions
- data fixtures remain independent of Playwright behavior

## Ordering and First Navigation

Centralization must preserve dependency order. Configuration, request
interception, identity, and state needed by the first application load must be
installed before navigation begins.

Resolving a high-level fixture may trigger navigation before a hook body runs.
Inspect fixture dependencies and use fixture options or lower-level dependencies
for pre-navigation setup. Do not boot the application and then repair state that
should have existed at startup.

## Parallelism, Retries, and External State

Assume tests execute concurrently and can retry in a fresh worker or context.
Resource identities must not collide, and cleanup must target only resources
owned by the current test or worker.

Page or context reset does not clean backend state, files, routes, sockets, or
other external resources. Define the complete state boundary. Prefer opt-in
fixtures when cleanup would erase persistence that some tests intentionally
verify.

Retries are diagnostic evidence, not isolation. Do not allow retries to conceal
pollution, ordering, or readiness failures.

## Readiness and Historical Guarantees

A fixture should hand control to the test only after reaching a real observable
readiness boundary. Never centralize arbitrary delays or suite-specific timing
assumptions.

Inspect history before removing waits, resets, or teardown from an existing
spec. Preserve any race or regression guarantee, even when replacing its
implementation.

## Migration Method

For one lifecycle responsibility at a time:

1. Map its fixture dependencies and external resources.
2. Determine what must happen before navigation.
3. Test whether repeated local setup is necessary.
4. Choose test, worker, or run scope from the resource lifetime.
5. Implement guaranteed teardown in the owning fixture.
6. Preserve opt-outs for tests whose behavior depends on retained state.

Do not move lifecycle code into an interaction helper merely because the helper
is widely used.

## Proof

Run affected specs first. Where pollution or timing is plausible, repeat the
targeted tests and exercise parallel execution. Verify failure cleanup when the
fixture owns external resources.

Then run the complete relevant browser suite and required static checks. Inspect
retry and flaky outcomes rather than relying only on the final green status.
