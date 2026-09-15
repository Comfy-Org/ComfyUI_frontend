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
Composability is how a suite gets both (Beck, Test Desiderata).

Rules below that cite a source restate that source's claim; the rest are this
repository's own choices. Sources are linked at the end.

## Test behavior, not structure

- Assert on return values, rendered output, emitted events, persisted state,
  and user-visible effects. Private state, call order, and internal forwarding
  are implementation (Meszaros, Use the Front Door First; Vocke).
- A test that restates the code's call sequence, its defaults, or its schema
  is a change detector: it fails on refactors and passes on bugs. Delete or
  rewrite it against outcomes (Google, Change-Detector Tests Considered
  Harmful).
- Prefer state and output verification. Verify a call when the call itself is
  the contract: a state-changing command on a boundary you own (Google, Only
  Verify State-Changing Method Calls), or an owned request whose parameters,
  caching, or deduplication are the observable behavior. Do not verify a query
  whose result is already visible in state or output, and do not assert call
  order unless order is a documented requirement (Beck, Programmer Test
  Principles).
- Assert on an attribute or CSS class only when that class is the documented
  state contract, as with Vue node state classes in E2E. Do not use a class as
  a stand-in for the behavior it represents.
- Query UI by role, label, text, or test ID. When no semantic query can find
  an interactive element, fix the component's semantics. Do not traverse the
  DOM or disable the lint rule.
- Exercise real code. Imagine deleting the production wiring. If every test
  still passes, nothing covers it.
- Do not test trivial code, the framework, or the mock (Vocke).

## Choose the lowest level that proves it

- Write many fast narrow tests, some integration tests, and few E2E tests. A
  higher-level test earns its place only by covering what lower levels cannot
  observe, such as wiring, real transport, or real rendering (Vocke).
- Unit test pure logic such as schemas, parsers, migrations, and keybinding
  parsing. Do not repeat its edge cases in E2E.
- When a high-level test fails and no low-level test does, add the missing
  low-level test. Once the lower level covers a behavior, delete the
  higher-level copy (Vocke).
- Prefer narrow integration tests against a faithful double, plus a contract
  test, over broad tests that need every live service (Fowler, Integration
  Test).
- A compatibility test is one narrow test per protected contract. Documented
  public and extension-facing contracts, such as serialization formats and
  extension APIs, get one proactively because a break reaches the ecosystem
  before we see evidence. For internal behavior, add one only after an
  observed breakage proves the contract matters.

## Compose dimensions instead of enumerating the cross-product

- With N variants on one dimension and M on another, and the dimensions
  separated in the design, write N + M + 1 tests rather than N × M: one table
  per dimension plus one composition test proving the dimensions are wired
  together (Beck, Composable Tests). Independence is the default hypothesis,
  not a coverage guarantee. Feature × view mode, widget × renderer × node
  state, and input class × failure mode are candidate dimensions; the sparse
  filter below handles the pairs that interact.
- Parameterized tests (`it.for`, table-driven) are the default whenever cases
  share one Arrange-Act-Assert shape and differ only in inputs and expected
  outputs. Give each case its own named row, put the expected value in the
  row, and keep branches out of the body (Go wiki, TableDrivenTests).
- When dimensions genuinely interact, filter sparsely rather than crossing
  them. Try pairwise coverage first, since most interaction faults involve two
  parameters (NIST, Combinatorial Testing), then an explicit list where each
  row states why it exists (boundary, regression, documented interaction). A
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

- Default to real collaborators and shared factories. Use a double only where
  the real collaborator is awkward, such as network, filesystem, clock, native
  dialogs, process exit, and slow or nondeterministic third parties.
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
- No conditionals or loops in a test body (Meszaros, Conditional Test Logic).
  A branch is two tests. A loop over inputs is a table. A loop over outputs is
  one assertion on the whole collection: map it and `toEqual` the expected
  array, or write a custom matcher. Narrowing is `assert.exists(x)` from
  vitest or a typed builder, cleanup is `afterEach`. Existing tests that loop
  are violations to fix when touched, not precedent.

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

Worked examples for each rule, for human readers and not loaded into agent
context, live in `docs/testing/testing-principles-examples.md`.

[Test Desiderata](https://github.com/KentBeck/TestDesiderata/blob/master/index.md),
[Composable Tests](https://tidyfirst.substack.com/p/composable-tests), and
[Programmer Test Principles](https://medium.com/@kentbeck_7670/programmer-test-principles-d01c064d7934)
(Beck);
[Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
(Vocke);
[Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html),
[Integration Test](https://martinfowler.com/bliki/IntegrationTest.html),
[Test Coverage](https://martinfowler.com/bliki/TestCoverage.html), and
[Eradicating Non-Determinism](https://martinfowler.com/articles/nonDeterminism.html)
(Fowler);
[Use the Front Door First](http://xunitpatterns.com/Principles%20of%20Test%20Automation.html)
and
[Conditional Test Logic](http://xunitpatterns.com/Conditional%20Test%20Logic.html)
(Meszaros, xUnit Test Patterns);
[Change-Detector Tests Considered Harmful](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html)
and
[Only Verify State-Changing Method Calls](https://testing.googleblog.com/2017/12/testing-on-toilet-only-verify-state.html)
(Google Testing on the Toilet);
[Don't Mock What You Don't Own](https://hynek.me/articles/what-to-mock-in-5-mins/)
(Schlawack);
[TableDrivenTests](https://go.dev/wiki/TableDrivenTests) (Go wiki);
[Combinatorial Testing](https://csrc.nist.gov/projects/automated-combinatorial-testing-for-software)
(NIST).
