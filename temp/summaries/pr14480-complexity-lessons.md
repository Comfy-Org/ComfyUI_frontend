# PR #14480 — Complexity Postmortem: What We Built That We Shouldn't Have (Yet)

Purpose: record the especially complex code removed during remediation, the reasoning error that produced each piece, and a heuristic to catch the same mistake earlier next time.

## Lesson 1: We built for a transport that doesn't exist

**What:** Remote-projection hardening, prepare/revalidate double-checking, split-register merge handling — all justified by "deterministic Yjs multiplayer behavior."
**The error:** We designed against the _data model's theoretical capabilities_ (Yjs can merge concurrent remote edits) instead of the _system's actual topology_ (a private in-memory `Y.Doc` with no provider, no `Y.applyUpdate`, no ingress). Every "concurrent" scenario in the tests had to be manufactured with a second hand-wired `Y.Doc` because production has no way to produce one.
**Heuristic:** before writing code that defends against concurrency, name the exact production code path that creates the race. If the only writer is synchronous local code, there is no race. "The library supports X" is not "the system does X."

## Lesson 2: Partial compensation is worse than no compensation

**What:** Saga-style teardown — snapshot layout registrations, delete, and on later failure emit compensating restore writes with ownership-aware "never overwrite foreign replacements" rules (~400 lines + per-entity test triplets).
**The error:** We made one subsystem (layout) transactional inside a multi-subsystem operation (graph teardown also mutates links, reroute chains, node state, Pinia stores, extension callbacks). On failure, the compensation restored geometry into a graph whose topology was already half-destroyed — producing a state that _looked_ recovered but wasn't. We paid saga complexity and got saga guarantees for one shard of the state.
**Heuristic:** compensation/rollback is only meaningful at the boundary that owns _all_ the state being mutated. If you can't restore everything, prefer fail-fast plus an idempotent rebuild (`sync from source of truth`) over precise partial undo.

## Lesson 3: A simple invariant enforced by a distributed protocol

**What:** "Only the instance that registered this layout may mutate it" — one sentence — implemented via tokens threaded through 9 modules, 3 WeakMaps, a pending-registration map, optional fields on serialized ops, mapper storage, and store-side comparisons, held together by ~19 unwritten cross-module invariants and 28 new exports.
**The error:** We enforced the invariant at every layer the token passed through instead of at the one layer that owns the data (the store). Each pass-through layer became a place to get the protocol wrong, and each entity type (node/group/reroute) got its own copy.
**Heuristic:** count the modules that must agree for a new invariant to hold. More than two-ish is a design smell — push enforcement into the data owner and hand callers an opaque handle. If you find yourself writing the same lifecycle three times for three entity types, write the adapter first.

## Lesson 4: Three-state semantics nobody asked for

**What:** `undefined` = legacy tokenless, `''` = valid owned token, non-empty string = owned token.
**The error:** We accepted `''` "to be safe" for inputs no production code ever constructs. That added a semantic state to every ownership comparison and forced tests to document behavior that shouldn't exist.
**Heuristic:** every representable state must have a producer. If no production code can construct a value, reject it at the boundary instead of assigning it meaning.

## Lesson 5: Tests that prove the mocks work

**What:** Failure-path tests that patched `Y.Map.set` to throw on specific keys, simulated partial transactions Yjs cannot produce, and threw `undefined` through compensation paths — per entity type.
**The error:** When the failure mode has no production source, the only way to test it is to fake the library — at which point the test verifies the fake. These tests then became the justification for keeping the machinery ("look, it's covered"), a circular argument: speculative code ⇢ synthetic tests ⇢ evidence the code is needed.
**Heuristic:** if you must patch a third-party library's internals to make a test fail, the code under test is defending against a scenario that doesn't exist. Delete the code, not just the test. (House rule already said it: don't mock what you don't own.)

**Phase 4 addendum:** the final pruning removed 383 more test lines of this kind — patched `Y.Doc.transact` throws with retry, `beforeTransaction` listeners injecting foreign `$map` replacements mid-registration, and delete/replace interleaving no local writer can produce. These tests were the load-bearing justification for the retry/saga machinery removed in Phase 2: fabricated concurrency in tests quietly becomes an architecture requirement in production code. Kept the distinction — `beforeTransaction` tests exercising real synchronous reentrancy/listener behavior stay; tests pretending there is a remote writer go. If a provider/remote ingress ever ships, these scenarios become reachable and should return _with_ the ingress path, not before it.

## Lesson 6: Optional-in-type, required-in-practice

**What:** `registrationId?` on serialized operations, where omitting it against an owned entity silently no-ops the mutation.
**The error:** The type system said "optional," the runtime said "mandatory or you fail silently." Silent no-op is the worst failure mode — it converts a programming error into a mystery.
**Heuristic:** when a field becomes required for a subset of states, split the types (owned op vs legacy op) or fail loudly. Optionality in a type is a promise that omission is fine.

## Lesson 7: Test volume as camouflage

**What:** 63% of the PR's added lines were tests, presented as rigor ("2.1 test lines per production line"). A third of those tests were copy-paste triplets and synthetic-failure suites for machinery being deleted.
**The error:** High test counts made the speculative machinery _feel_ validated and made the PR harder to review — the reviewer must read 4,000 test lines to notice the production code defends against nothing reachable. Volume was mistaken for coverage.
**Heuristic:** in review, sample the tests that justify the most complex production paths and ask "what production event triggers this?" before admiring the count. Parameterize entity-type triplets on sight.

## Lesson 8: Teardown ordering created the need for compensation

**What:** During node removal, released subgraphs were layout-unregistered _before_ the fallible extension callbacks (`onRemoved`, deselection) ran. Any callback throw then required graph-wide restoration of everything already unregistered — which is what justified the saga machinery in the first place.
**The error:** We destroyed state early and then built elaborate machinery to un-destroy it on failure, instead of not destroying it until failure was no longer possible. The compensation complexity was self-inflicted by ordering, not demanded by the problem.
**Heuristic:** sequence lifecycle operations as validate → fallible callbacks → irreversible teardown. If a failure path needs multi-domain restoration, first check whether reordering makes the restoration unnecessary. Rollback machinery that exists only because of eager destruction is a smell pointing at the ordering, not at missing infrastructure.

## Lesson 9: Schema migration for data that is never persisted

**What:** `yNodeGeometry` read a legacy `rect` tuple as fallback for the new split `position`/`size` registers, with three migration tests covering rect-only, rect+position, and rect+size documents.
**The error:** Migration hygiene reflex applied to an in-memory document. The layout `Y.Doc` is never serialized, persisted, or exchanged — every document is created fresh by the current code, so a pre-split document cannot exist anywhere. The fallback threaded a phantom schema version through every geometry read.
**Heuristic:** backward-compatibility code needs a place where old data actually lives (disk, server, another client). If the data's entire lifetime is one process running one code version, there is nothing to migrate. Write migration when persistence ships, not before.

## Lesson 10: IDs are only unique within their scope (found during remediation)

**What:** Making link-topology cleanup store-owned exposed a latent trap: `registerLinkTopology(..., adoptExisting = true)` adopted persisted link state purely by link ID. Link topology is bucketed by _root_ graph, but each pasted/live subgraph reuses its own internal link ID space — so a pasted subgraph's link 1 adopted the live subgraph's link 1, inheriting foreign endpoints, and the pasted reroutes were then pruned as orphans. Caught by the existing behavioral clipboard test (`pasting a subgraph node remaps colliding reroute ids...`).
**The error:** Treating an ID as a global key when it is only unique per-subgraph. Adoption needed an identity check (same endpoints), not just a key match.
**Heuristic:** whenever a lookup crosses a scope boundary (subgraph → root-graph bucket), the key alone is not identity — verify a second invariant of the value before adopting it. And: this regression was caught by a _behavioral_ end-to-end test, not by any of the 383 lines of synthetic-failure tests we deleted. Real-scenario tests earn their keep.

## Meta-pattern

All the pre-remediation lessons (1–9) share one root: **designing for the system we intend to build instead of the system we have**, then generating proof (tests, invariants, compensation) sized to the intended system. The fix is not less rigor — it's anchoring rigor to reachable states. Next multiplayer-preparation PR should start by landing the ingress path (provider/update application) first, so every defensive layer added after it has a real adversary.
