---
globs:
  - '**/*.test.ts'
  - '**/*.spec.ts'
---

# Testing Principles

These rules hold at every level: unit, store, component, integration, and E2E.
Mechanics live elsewhere. `docs/guidance/vitest.md` and `docs/testing/*.md`
cover Vitest; `browser_tests/README.md` covers Playwright. When a mechanic and
a principle disagree, the principle wins and the mechanic gets fixed.

We want the smallest set of tests that fails when a behavior users depend on
changes. The same tests must keep passing through any refactor that preserves
that behavior.

## Judge every test by Beck's Test Desiderata

Beck names twelve properties: isolated, composable, deterministic, fast,
writable, readable, behavioral, structure-insensitive, automated, specific,
predictive, inspiring. Give one up only to gain a more valuable one. Unit
tests trade predictive for fast and specific; E2E tests trade the reverse.
Composability is how a suite gets both.

## Test behavior, not structure

- Assert through the front door: return values, rendered output, emitted
  events, persisted state, user-visible effects. Private state, call order,
  and internal forwarding are implementation.
- A test that restates the code's call sequence, its defaults, or its schema
  is a change detector: it fails on refactors and passes on bugs. Delete or
  rewrite it against outcomes.
- Verify a call only when the call is the contract: a state-changing command
  on a boundary you own. Never verify queries.
- Assert on an attribute or CSS class only when that class is the documented
  state contract, as with Vue node state classes in E2E. Do not use a class as
  a stand-in for the behavior it represents.
- Query UI by role, label, text, or test ID. When no semantic query can find
  an interactive element, fix the component's semantics. Do not traverse the
  DOM or disable the lint rule.
- Exercise real code. Imagine deleting the production wiring. If every test
  still passes, nothing covers it.
- Do not test trivial code, the framework, or the mock.

## Choose the lowest level that proves it

- Write many fast narrow tests, some integration tests, and few E2E tests. A
  higher-level test earns its place only by covering what lower levels cannot
  observe, such as wiring, real transport, or real rendering.
- Unit test pure logic such as schemas, parsers, migrations, and keybinding
  parsing. Do not repeat its edge cases in E2E.
- When a high-level test fails and no low-level test does, add the missing
  low-level test. Once the lower level covers a behavior, delete the
  higher-level copy.
- A compatibility test is one narrow test per protected contract. Add one only
  after an observed breakage proves the contract matters.

## Compose dimensions instead of enumerating the cross-product

- With N variants on one dimension and M on another, write N + M + 1 tests
  rather than N × M: one table per dimension plus one composition test proving
  the dimensions are wired together. Feature × view mode, widget × renderer ×
  node state, and input class × failure mode are all dimensions.
- Parameterized tests (`it.each`, table-driven) are the default whenever cases
  share one Arrange-Act-Assert shape and differ only in inputs and expected
  outputs. Give each case its own named row, put the expected value in the
  row, and keep branches out of the body.
- When dimensions genuinely interact, filter sparsely rather than crossing
  them. Try pairwise coverage first, then an explicit list where each row
  states why it exists (boundary, regression, documented interaction). A
  constraint filter may drop only combinations production can never produce.
  Give the table a runtime budget and hold it.
- Choose rows so a plausible wrong implementation fails: one per equivalence
  class, both sides of each boundary, every past regression. Symmetric and
  round inputs hide swapped arguments and off-by-one bugs.
- When test B cannot pass unless test A passes, trim B to what only B asserts.

## Isolated and deterministic

- Every test builds its own fresh fixture and gives the same result alone, in
  any order, in parallel, and on retry. Mutable scenario state is test-scoped.
  A shared variable is fine when it owns a per-test resource or a value that
  teardown must restore.
- Shared setup establishes invariants, not scenarios. State that explains one
  scenario stays beside that scenario. Put setup at the narrowest lifecycle
  owner that matches its lifetime. Setup and teardown are one contract:
  cleanup runs after failures and touches only resources the test owns.
- Never sleep. Wait on the real readiness boundary, using an observable
  condition, the smallest retrying assertion that matches it, fake timers, or
  a deferred promise. Poll internal state only when no user-facing surface
  exists.
- Identify elements by stable identity, not by nondeterministic order or pixel
  coordinates. Avoid check-then-act races and forced actions that bypass
  actionability checks.
- Retries reveal flakes; they do not fix them. A flaky test is worse than no
  test because it teaches people to ignore red. Diagnose the race, state it,
  and fix the synchronization without weakening the assertion.
- Unit tests make no real network calls. Wrap time, randomness, and identity
  generation so tests can control them.

## Doubles: real collaborators first

- Default to real collaborators and shared factories. Double only awkward
  boundaries: network, filesystem, clock, native dialogs, process exit, and
  slow or nondeterministic third parties.
- Mock what you own. Wrap a behavior-rich third-party API in a facade and
  double the facade. A single-method third-party hook may be mocked directly.
  Never mock the module under test or a project-owned module you are trying to
  exercise.
- Prefer fakes and state verification to behavior verification. A mock that
  returns a mock, or mock setup longer than the test, means the seam is wrong.
- Build typed fixtures from authoritative types or schemas. Malformed external
  input stays `unknown` and goes through the production parser. Never cast it
  to the domain type.

## Readable

- One behavior per test. The name states the behavior and its condition, not
  the method name. Arrange, act, assert.
- Inside a test, prefer some repetition to indirection. The reader should see
  cause and effect without leaving the body. Extract a helper only when it
  owns policy, lifecycle, or real complexity. Never extract the values that
  determine the expected outcome, and never write a wrapper that only renames
  a mock.
- Expected values are literal or checkable by hand. Never compute the
  expectation with the logic under test.
- No conditionals or loops in a test body. A branch is two tests; a loop is a
  table.

## Use coverage to find gaps, not to hit a number

- Line coverage shows what ran. It cannot see missing assertions. Use it to
  find code to worry about, never as a percentage to chase.
- Cover the negative, boundary, empty, and error paths, not only the happy
  path.
- A bugfix test must fail on pre-fix code. A regression test that never went
  red pins nothing.

## Changing existing tests

- Diagnose the failure before touching the test. Missing expected UI is a
  probable regression, not a test to skip. Never weaken, remove, or snapshot
  over an assertion to get green.
- Before deleting an assertion, wait, reset, or guard you did not write, read
  the commit that introduced it. Keep the guarantee or replace it with an
  equivalent.
- Similar text that reaches different production branches, race branches, or
  distinct failure origins is not duplication. Keep those and table the rest.
- After changing shared setup or lifecycle, run the whole affected suite, not
  only the targeted tests.

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
