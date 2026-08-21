# Test-quality review

Evaluate the tests added with (or missing from) a change. Applies to `test/**` and to `src/**` changes that add or modify behavior.

Check for:

1. **Missing tests** — new op behavior, new rejection code, or changed applier/projection logic without coverage. A pure refactor with no behavior change does not need new tests.
2. **Weak assertions** — asserting only that an op failed (`failed.code`) without asserting the document state it should or should not have produced. For rejections the assertion of record is **`Y.encodeStateAsUpdate` byte identity plus the `op_id`'s absence from `__applied`**, not a `project(doc)` snapshot: `project()` does not render `__stamps` or `__applied`, so a rejected op that has already claimed a register yields `bytesEq=false, projEq=true` and no projection assertion in the repo can see it (KA-4). Also assert that a trailing valid op after a rejected one does not apply (abort-remainder). This is the exact gap that let issue #10 hide, and the projection-only version of the fix is what let the empty-destination member of the class outlive it.
3. **Change-detector tests** — asserting internal structure to pin an implementation detail, rather than a property. This is *not* a licence to prefer `project()` for invariant tests: see item 2 and [`vacuity.md`](vacuity.md) P10. The genuine exception is the **accepted** delete-wins/LWW-dropped no-op, which deliberately consumes an `op_id`, so raw state is intentionally not byte-identical there; compare projections for those, and bytes for rejections.
4. **Convergence/idempotency gaps** — an op-semantics change without a test applying the op set in both arrival orders (must converge) and a double-apply test (duplicate `op_id` must be a true no-op).
5. **Missing edge/error cases** — happy path only; no empty/null/malformed/uncatalogued/out-of-range scenarios.
6. **Fragile or order-dependent tests** — shared mutable state between tests, reliance on execution order, unstable `op_id`/actor generation.
7. **Readability** — unclear test names, setup that obscures intent.
8. **Unreachable input** — the test exercises an input class in which the guarded path is never entered, so it would pass with the fix reverted. The tell is the parameter the bug is about sitting at its empty or identity value (`[]`, `{}`, `0`, `null`, a single-element collection, a default) while the test name states a general property. Live example in this repo: a convergence regression test written with `removed_links: []`, when the link-severance ordering bug is reachable only when `removed_links` is non-empty. Apply [`vacuity.md`](vacuity.md) P1 against the **general** input, not the pinned one.
9. **Degenerate fixture** — the input class is right and the fixture is too small or too empty to distinguish the property from its negation. A two-element fixture cannot tell "exactly one" from "all but one"; `emptyWorkflow` cannot exhibit "leaves the document byte-identical"; a node that already has a widgets map cannot exercise a guard that fires when the map is created. Read the fixture's cardinality and occupancy against the property's quantifier, then apply [`vacuity.md`](vacuity.md) P11. "Equivalent mutant" is a claim, not a default.
10. **Inadequate observable** — the test runs, can fail, has an independent oracle and no double, and still asserts on a surface too coarse to hold the violation. Ask [`vacuity.md`](vacuity.md) P10's question: *what is the smallest violation of this property that leaves the asserted value unchanged?*

Repo conventions:

- **`*.regression.test.*` files get more scrutiny, not less.** Each one is the sole evidence that a specific bug is closed, so a vacuous regression test retires a bug that is still live. This profile's naming and assertion-style conventions are relaxed there (a regression test may pin a concrete reproduction rather than assert a general property); its correctness conventions are not. Items 2, 4, 8, 9 and 10 above apply in full, and items 8 and 9 apply with priority.

- Tests use **Vitest** (`npm test`) and live under **`test/`** (not colocated). Property tests use **fast-check**; conformance fixtures are SHA-pinned and verified in CI (`npm run verify:corpus`); mutation testing is **Stryker** (`npm run test:mutation`, then `npm run check:mutation-report` — a score quoted without the second command is not a measurement, because Stryker scores a timeout as a kill; see `docs/mutation-testing.md`).
- Never use `any` in tests; deliberate invalid inputs are cast narrowly (`as unknown as Op`) at the single line under test.
- "Major" for missing tests on applier/ordering/fail-closed logic; "minor" for a missing peripheral edge case.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
