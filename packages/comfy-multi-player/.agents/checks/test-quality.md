# Test-quality review

Evaluate the tests added with (or missing from) a change. Applies to `test/**` and to `src/**` changes that add or modify behavior.

Check for:

1. **Missing tests** — new op behavior, new rejection code, or changed applier/projection logic without coverage. A pure refactor with no behavior change does not need new tests.
2. **Weak assertions** — asserting only that an op failed (`failed.code`) without asserting the document state it should or should not have produced. For rejections the assertion of record is **`Y.encodeStateAsUpdate` byte identity plus the `op_id`'s absence from `__applied`**, not a `project(doc)` snapshot: `project()` does not render `__stamps` or `__applied`, so a rejected op that has already claimed a register yields `bytesEq=false, projEq=true` and no projection assertion in the repo can see it (KA-4). Also assert that a trailing valid op after a rejected one does not apply (abort-remainder). This is the exact gap that let issue #10 hide, and the projection-only version of the fix is what let the empty-destination member of the class outlive it.
   Three refinements, each of which a reviewer applying the rule literally would otherwise get wrong.
   **A third observable.** `applyOps` calls `appliedMap(doc)` before it validates anything and `getMap` *creates* an absent root, so on a snapshot-forked replica a rejected op can materialize a root while the bytes stay identical — an empty root encodes to zero bytes (schema A5, KA-11). Assert `[...doc.share.keys()]` too. Since #29 the ledger accessors are module-private; a test imports them from `../src/doc.js`, as `test/ka4-rejection-byte-identity.test.ts` does.
   **Scope it to ONE document.** The rule is a before/after on a single doc. It is not a claim that bytes are the oracle for anything involving rejections: KA-4's op-only vectors compare two replicas that applied the same ops in different orders, and those hold different Yjs clocks legitimately, so there the oracle is the projection or the disposition. Flag "bytes" offered for a cross-replica comparison exactly as readily as "projection" offered for a single-document one.
   **State #10's status accurately.** PR #34 narrowed it, it is **not closed**, and byte identity holds today for every rejection the applier raises deliberately as an `OpRejectedError` — not for the four residual paths that mutate and then throw a raw error surfaced as `apply_failed` (#59, #61, #68; `delete_node` with a non-array `removed_links` still deletes the node first). Those are enumerated in `src/applier.ts`'s module comment and in `README.md`. The `bytesEq=false, projEq=true` figure above is the shape of the defect, not a live measurement: reproduce it on demand by planting one stray ledger write ahead of a rejection throw, which is what makes the point independent of whether any particular bug is currently open.
3. **Change-detector tests** — asserting internal structure to pin an implementation detail, rather than a property. This is *not* a licence to prefer `project()` for invariant tests: see item 2 and [`vacuity.md`](vacuity.md) P10. The genuine exception is the **accepted** no-op that still consumes an `op_id` — delete-wins and LWW-dropped, including `connect`'s `if (!dst) return` — so raw state is intentionally not byte-identical there; compare projections for their **graph effect**, and bytes for rejections. (`applyAddNode`'s structural-idempotency return used to belong on that list; Amendment A7's node-presence stamp gate closed it, so do not re-add it.) Do not use the projection for the `op_id` consumption itself: that is the very thing being carved out and the projection cannot see it, so the observable there is `appliedMap(doc)` or `ApplyResult.applied`.
4. **Convergence/idempotency gaps** — an op-semantics change without a test applying the op set in both arrival orders (must converge) and a double-apply test (duplicate `op_id` must be a true no-op).
5. **Missing edge/error cases** — happy path only; no empty/null/malformed/uncatalogued/out-of-range scenarios.
6. **Fragile or order-dependent tests** — shared mutable state between tests, reliance on execution order, unstable `op_id`/actor generation.
7. **Readability** — unclear test names, setup that obscures intent.
8. **Unreachable input** — the test exercises an input class in which the guarded path is never entered, so it would pass with the fix reverted. The tell is the parameter the bug is about sitting at its empty or identity value (`[]`, `{}`, `0`, `null`, a single-element collection, a default) while the test name states a general property. Live example in this repo: a convergence regression test written with `removed_links: []`, when the link-severance ordering bug is reachable only when `removed_links` is non-empty. Apply [`vacuity.md`](vacuity.md) P1 against the **general** input, not the pinned one.
9. **Degenerate fixture** — the input class is right and the fixture is too small or too empty to distinguish the property from its negation. A two-element fixture cannot tell "exactly one" from "all but one"; `emptyWorkflow` cannot exhibit "leaves the document byte-identical"; a node that already has a widgets map cannot exercise a guard that fires when the map is created. Read the fixture's cardinality and occupancy against the property's quantifier, then apply [`vacuity.md`](vacuity.md) P11. "Equivalent mutant" is a claim, not a default.
10. **Inadequate observable** — the test runs, can fail, has an independent oracle and no double, and still asserts on a surface too coarse to hold the violation. Ask [`vacuity.md`](vacuity.md) P10's question: *what is the smallest violation of this property that leaves the asserted value unchanged?*

## Ranking the adequate observables: then localizing

Item 10 and [`vacuity.md`](vacuity.md) P10 settle whether an observable is **adequate** — whether it has room to be false. This section is the step after that, and it is the half a reviewer who has just learned P10 tends to overshoot: among the observables that *can* express the violation, prefer the one that tells you **where**. Going finer than the property requires buys detection and pays in diagnosis.

| Property under test | Inadequate | Adequate, poor diagnosis | Adequate and localizing |
| --- | --- | --- | --- |
| a rejected op changes nothing | `project(doc)` | — | `Y.encodeStateAsUpdate` bytes (the property *is* "no byte changed", so bytes both detect and name it) |
| no bookkeeping key leaks into `meta` | `project(doc)` | encoded bytes ("these bytes differ from those") | `[...metaMap(doc).keys()].sort()` — names the leaked key |
| a read path materializes no root type | encoded bytes (an empty root encodes to zero bytes) | — | `[...doc.share.keys()]` |

So "assert on bytes" is not the lesson of item 2 and must not be applied as one; bytes are right there because the property genuinely is byte identity. Flag a byte assertion offered for a property that is really about one key or one root as readily as a projection assertion offered for a property the projection does not render.

Repo conventions:

- **`*.regression.test.*` files get more scrutiny, not less.** Each one is the sole evidence that a specific bug is closed, so a vacuous regression test retires a bug that is still live. This profile's naming and assertion-style conventions are relaxed there (a regression test may pin a concrete reproduction rather than assert a general property); its correctness conventions are not. Items 2, 4, 8, 9 and 10 above apply in full, and items 8 and 9 apply with priority.

- Tests use **Vitest** (`npm test`) and live under **`test/`** (not colocated). Property tests use **fast-check**; conformance fixtures are SHA-pinned and verified in CI (`npm run verify:corpus`); mutation testing is **Stryker** (`npm run test:mutation`, then `npm run check:mutation-report` — a score quoted without the second command is not a measurement, because Stryker scores a timeout as a kill; see `docs/mutation-testing.md`).
- Never use `any` in tests; deliberate invalid inputs are cast narrowly (`as unknown as Op`) at the single line under test.
- "Major" for missing tests on applier/ordering/fail-closed logic; "minor" for a missing peripheral edge case. An inadequate observable (see above) is "major" wherever a missing test would be: the coverage it reports is not coverage.

## Machine-consumed copy

The block below **is** `.coderabbit.yaml`'s `path_instructions` entry for `test/**`, not a
description of it: `npm run gen:coderabbit` emits the YAML from this block and
`npm run check:coderabbit` fails CI when the two disagree, so the file is a build product and this
is the only editable copy. That is the structural fix for the reason item 2's oracle outlived its
first correction: #43 (`7c454eb`) created both copies in one commit, #53 (`547ae7b`) corrected this
file and left `.coderabbit.yaml` saying the retired thing, and it took #74 (`2e42423`) to find both
by hand. The bot copy lived in a different file, in a different format, and was not greppable from
this one.

Write it for the bot: **self-contained**, since `path_instructions` are injected as literal text and
this profile is never loaded alongside them. Keep item 3's accepted-op carve-out in it — the first
draft of this block dropped it, which would have had the bot flagging seven existing suites that
compare projections correctly.

<!-- coderabbit-instructions: test/** -->
```text
This block is the complete instruction; .agents/checks/test-quality.md is
the human copy of it and is NOT loaded for you, so do not assume context
from it. Rejection tests must assert the document state, not only
failed.code. For a REJECTED op the oracle is byte identity under
Y.encodeStateAsUpdate plus the op_id absent from __applied, NOT the
projection: project() renders neither __stamps nor __applied, so a write
into either is invisible to it while the document has really diverged. Also
verify a trailing valid op after a rejected one does not apply
(abort-remainder). This byte rule is scoped to REJECTIONS only and is NOT a
general preference for byte assertions. For an ACCEPTED op the default
observable is the projection: accepted delete-wins and LWW-dropped no-ops
deliberately consume an op_id, so their encoded state is intentionally NOT
byte-identical, and convergence tests compare projections across arrival
orders because the ledgers differ by construction. Never ask for byte
identity on an accepted op or across two independently built docs, and do
not ask for it where the property is really about one key or one root.
Otherwise check only that the chosen observable can express the violation
under test, preferring one that also names where it happened. Op-semantics
tests need both arrival orders (convergence) and a double-apply no-op
(idempotency). No `any` in tests; cast invalid inputs narrowly at the single
line under test. Tests use Vitest under test/.
```
<!-- /coderabbit-instructions -->

## Claim anchors

Every checkable fact this profile restates, and every phrase it has retired, pinned by `npm run check:profile-claims` (see [`README.md`](README.md)). Grouped, not scattered, because item 2's history is that the anchors are the load-bearing part of the document.

The item-2 oracle, and the deference to the profile that owns it:

<!-- claim: a failed op must leave encoded document bytes unchanged :: .agents/checks/convergence-idempotency.md -->
<!-- claim: encodeStateAsUpdate must be byte-identical :: test/ka4-rejection-byte-identity.test.ts -->
<!-- claim: encodeStateAsUpdate must be byte-identical :: test/w8-applier-stamps-edge.test.ts -->
<!-- claim: MIGRATED from KNOWN_KA4_VIOLATIONS when PR #34 landed :: test/ka4-rejection-byte-identity.test.ts -->
<!-- claim: import { appliedMap } from "../src/doc.js"; :: test/ka4-rejection-byte-identity.test.ts -->
<!-- claim: break; // abort-remainder :: src/applier.ts -->
<!-- claim: a delete-wins no-op that CONSUMES the `op_id` :: src/applier.ts -->
<!-- claim: CLOSED by Amendment A7 :: docs/multiplayer-schema.md -->

Why the projection is inadequate. `project()` must not reach either ledger, and it now has THREE ways to do so: the raw root names, the `ROOT_*` name constants, and the `doc.ts` accessors that are the realistic route (`src/project.ts` reaches doc state only through imported helpers, so a projection that started rendering stamps would add `stampsMap`, never the literal `__stamps`). All six spellings are banned. The `ROOT_STAMPS`/`ROOT_APPLIED` bans arrived with the read-only snapshot surface, which named the roots as constants so the writer helpers and the reader could not drift: that indirection is a route the four original bans did not enumerate, and a ban is only as good as the name it enumerates. For the same reason the positive markers pin **every** hop of each accessor — the exported identifier, the constant it resolves through, and the string that constant holds — because pinning the body alone would let `stampsMap` be renamed with the positive claims still green while `claim-absent: stampsMap` quietly became a ban on a string that exists nowhere.

<!-- claim-absent: __stamps :: src/project.ts -->
<!-- claim-absent: __applied :: src/project.ts -->
<!-- claim-absent: stampsMap :: src/project.ts -->
<!-- claim-absent: appliedMap :: src/project.ts -->
<!-- claim-absent: ROOT_STAMPS :: src/project.ts -->
<!-- claim-absent: ROOT_APPLIED :: src/project.ts -->
<!-- claim: export const ROOT_APPLIED = "__applied"; :: src/doc.ts -->
<!-- claim: export const ROOT_STAMPS = "__stamps"; :: src/doc.ts -->
<!-- claim: export function stampsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(ROOT_STAMPS); :: src/doc.ts -->
<!-- claim: export function appliedMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(ROOT_APPLIED); :: src/doc.ts -->

The retired advice, banned in both copies — this file and the machine-consumed restatement in `.coderabbit.yaml`, which is the copy that runs on every PR and the one the earlier fixes never looked at. All `.coderabbit.yaml` needles are deliberately space-free: that block is a YAML folded scalar, so a needle containing a space could be split by a cosmetic rewrap, which would redden a positive claim and, worse, silently disarm a ban.

These three markers are **not** made redundant by the generator above, and the distinction is worth stating because "it is generated, so it cannot diverge" is only half true. `check:coderabbit` proves the YAML matches the *source block*; it says nothing about whether the source block still says the right thing. An author who re-typed the retired oracle into the block above and regenerated would pass that gate and fail these markers. Generation removes the transport copy; the markers hold the content.

The limit of that, said plainly rather than left to be discovered: these are substring tripwires on two exact spellings. A **paraphrase** — "show the projection is identical before and after the rejected op" — regenerates cleanly and passes every gate in this repo. That was measured against this tree, not assumed. The ban set cannot simply be widened, because this block's own correct text contains `project()` and `projection`. The residue is #74's and is unchanged; someone still has to read the block.

<!-- claim-absent: the projection must be unchanged :: .agents/checks/test-quality.md -->
<!-- claim-absent: project(doc) :: .coderabbit.yaml -->
<!-- claim: Y.encodeStateAsUpdate :: .coderabbit.yaml -->

**The carve-out in item 3 is anchored too, and that is not redundant.** A restatement can drift by *omission* as easily as by contradiction, and omission is invisible to a gate that pins phrases. The first draft of the `.coderabbit.yaml` block carried the byte rule without item 3's accepted-op exception, which would have had the bot flagging seven existing suites that compare projections correctly — the same copy-divergence bug as the original, pointing the other way. These two needles make the exception's *presence* in the bot copy merge-blocking:

<!-- claim: delete-wins :: .coderabbit.yaml -->
<!-- claim: LWW-dropped :: .coderabbit.yaml -->

The observable table and the conventions block:

<!-- claim: [...metaMap(doc).keys()].sort() :: test/doc-mint-mutation-survivors.test.ts -->
<!-- claim: [...doc.share.keys()] :: test/roundtrip.test.ts -->
<!-- claim: "check:coderabbit": "node scripts/gen-coderabbit-config.mjs" :: package.json -->
<!-- claim: "gen:coderabbit": "node scripts/gen-coderabbit-config.mjs --write" :: package.json -->
<!-- claim: "test": "vitest run" :: package.json -->
<!-- claim: "check:mutation-report": "node scripts/check-mutation-report.mjs" :: package.json -->
<!-- claim: "verify:corpus": "node scripts/verify-corpus.mjs" :: package.json -->

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
