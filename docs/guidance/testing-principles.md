---
globs:
  - '**/*.test.ts'
  - '**/*.spec.ts'
---

# Testing Principles

Rules that hold at every level: unit, store, component, integration, and E2E.
Mechanics live elsewhere: `docs/guidance/vitest.md` and `docs/testing/*.md` for
Vitest, `browser_tests/README.md` for Playwright. When a mechanic and a
principle disagree, the principle wins; fix the mechanic.

The goal is the smallest set of tests that fails when a behavior users depend
on changes and keeps passing through any refactor that preserves it.

## Judge every test by Beck's Test Desiderata

Isolated, composable, deterministic, fast, writable, readable, behavioral,
structure-insensitive, automated, specific, predictive, inspiring. Trade one
property only for a more valuable one. Unit tests trade predictive for fast
and specific; E2E tests trade the reverse. Composability lets a suite be both.

## Test behavior, not structure

- Assert through the front door: return values, rendered output, emitted
  events, persisted state, user-visible effects. Private state, call order,
  and internal forwarding are implementation.
- A test that restates the code's call sequence, its defaults, or its schema
  is a change detector: it fails on refactors and passes on bugs. Delete or
  rewrite it against outcomes.
- Verify a call only when the call is the contract: a state-changing command
  on a boundary you own. Never verify queries.
- Assert on attributes or CSS classes only when that class is the documented
  state contract (Vue node state classes in E2E). Never as a stand-in for the
  behavior the class represents.
- Query UI by role, label, text, or test ID. When no semantic query can find
  an interactive element, fix the component's semantics; do not traverse DOM
  or disable the lint rule.
- Exercise real code. Remove the production wiring in your head: if every test
  still passes, nothing covers it.
- Do not test trivial code, the framework, or the mock.

## Choose the lowest level that proves it

- Many fast narrow tests, some integration tests, few E2E tests. A higher-level
  test earns its place only by covering what lower levels cannot observe:
  wiring, real transport, real rendering.
- Pure logic (schemas, parsers, migrations, keybinding parsing) is unit tested.
  Do not repeat its edge cases in E2E.
- When a high-level test fails and no low-level test does, add the missing
  low-level test. Once the lower level covers a behavior, delete the
  higher-level copy.
- Compatibility tests are one narrow test per protected contract, added only
  when an observed breakage proves the contract matters.

## Compose dimensions; never enumerate the cross-product

- With N variants on one dimension and M on another, write N + M + 1 tests:
  one table per dimension plus one composition test proving they are wired
  together. Not N × M. Feature × view mode, widget × renderer × node state, and
  input class × failure mode are all dimensions.
- Parameterized (`it.each`, table-driven) tests are the default whenever cases
  share one Arrange-Act-Assert shape and differ only in inputs and expected
  outputs. One named row per case; every row carries its explicit expectation;
  no branches in the body.
- When dimensions genuinely interact, filter sparsely rather than crossing:
  pairwise coverage, then an explicit list where each row states why it exists
  (boundary, regression, documented interaction). A constraint filter may drop
  only combinations production can never produce. Hold a runtime budget for
  the table.
- Choose rows so a plausible wrong implementation fails: one per equivalence
  class, both sides of each boundary, every past regression. Symmetric and
  round inputs hide swapped arguments and off-by-one bugs.
- When test B cannot pass unless test A passes, trim B to what only B asserts.

## Isolated and deterministic

- Every test builds its own fresh fixture and runs the same alone, in any
  order, in parallel, and on retry. Mutable scenario state is test-scoped; a
  shared variable is fine only when it owns a per-test resource or a value
  teardown must restore.
- Shared setup centralizes invariants, not scenarios. State that explains one
  scenario stays beside that scenario. Put setup at the narrowest lifecycle
  owner that matches its lifetime; setup and teardown are one contract, and
  cleanup runs after failures and touches only resources the test owns.
- Never sleep. Wait on the real readiness boundary: an observable condition,
  the smallest retrying assertion that matches it, fake timers, or a deferred
  promise. Poll internal state only when no user-facing surface exists.
- Identify elements by stable identity, not nondeterministic order or pixel
  coordinates. Avoid check-then-act races and forced actions that bypass
  actionability.
- Retries reveal flakes; they do not fix them. A flaky test is worse than none:
  diagnose the race, state it, and fix the synchronization without weakening
  the assertion.
- No real network in unit tests. Wrap time, randomness, and identity so tests
  can control them.

## Doubles: real collaborators first

- Default to real collaborators and shared factories. Double only awkward
  boundaries: network, filesystem, clock, native dialogs, process exit, slow or
  nondeterministic third parties.
- Mock what you own. Wrap a behavior-rich third-party API in a facade and
  double the facade; a single-method third-party hook may be mocked directly.
  Never mock the module under test or a project-owned module you are trying to
  exercise.
- Prefer fakes and state verification to behavior verification. A mock that
  returns a mock, or mock setup longer than the test, means the seam is wrong.
- Build typed fixtures from authoritative types or schemas. Malformed external
  input stays `unknown` and goes through the production parser; never cast it
  to the domain type.

## Readable

- One behavior per test. The name states the behavior and its condition, not
  the method name. Arrange, Act, Assert.
- DAMP over DRY inside a test: cause and effect are visible without leaving the
  body. Extract helpers for irrelevant setup only when they own policy,
  lifecycle, or meaningful complexity; never for the values that determine the
  expected outcome, and never as a wrapper that merely renames a mock.
- Expected values are literal or hand-checkable. Never compute the expectation
  with the logic under test.
- No conditionals or loops in a test body: a branch is two tests, a loop is a
  table.

## Coverage is a map, not a target

- Line coverage finds execution gaps; it cannot see missing assertions. Use it
  to find code to worry about, never as a percentage to chase.
- Cover the negative, boundary, empty, and error paths, not only the happy path.
- A bugfix test must fail on pre-fix code. A regression test that never went
  red pins nothing.

## Changing existing tests

- Diagnose the failure before touching the test. A missing expected UI is a
  probable regression, not a test to skip. Never weaken, remove, or snapshot
  over an assertion to go green.
- Before deleting an assertion, wait, reset, or guard you did not write, read
  the commit that introduced it. Preserve the guarantee, or replace it with an
  equivalent.
- Similar text reaching different production branches, race branches, or
  distinct failure origins is not duplication. Keep those; table the rest.
- After changing shared setup or lifecycle, run the complete affected suite,
  not only the targeted tests.

## Sources

[Test Desiderata](https://github.com/KentBeck/TestDesiderata/blob/master/index.md) and
[Composable Tests](https://tidyfirst.substack.com/p/composable-tests) (Beck);
[Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html),
[Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html),
[Test Coverage](https://martinfowler.com/bliki/TestCoverage.html), and
[Eradicating Non-Determinism](https://martinfowler.com/articles/nonDeterminism.html)
(Fowler);
[Don't Mock What You Don't Own](https://hynek.me/articles/what-to-mock-in-5-mins/)
(Schlawack).
