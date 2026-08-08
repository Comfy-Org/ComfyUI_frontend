# PR #14480 Remediation Plan — YAGNI Prune & Simplify

Branch: `drjkl/layout-crdt-safety` → base `origin/feature/ecs-migration`
Goal: keep every protection a single-client user can experience today; remove machinery that only pays off under multiplayer/remote CRDT ingress that does not exist yet. Target: **−450 to −650 production lines, −800 to −1,200 test lines.**

Tracking documents (update as each phase lands):

- Pruned-capability ledger: `temp/summaries/pr14480-pruned-items.md`
- Complexity postmortem: `temp/summaries/pr14480-complexity-lessons.md`
- Progress checklist: `temp/in_progress/pr14480-remediation-progress.md`

## Decision record (defaults chosen; veto if wrong)

| Decision                                  | Choice                                    | Rationale                                                                                                                      |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Split position/size Yjs registers         | **KEEP** the split schema                 | Already written, small; redoing the schema after persistence ships is expensive.                                               |
| Legacy `rect` fallback in mappers         | **REMOVE**                                | Migration code for persisted data that cannot exist — the Y.Doc is in-memory only, never persisted or synced. Dead on arrival. |
| `applied`/`no-op`/`rejected` outcome type | **KEEP**                                  | Real production consumers: `no-op` drives adoption (`LGraph.ts:1829`), `rejected` blocks reentrant teardown (`LGraph.ts:603`). |
| Per-instance ownership tokens             | **KEEP** (consolidated)                   | Protects against real single-client bugs: ID reuse after reload, stale instances after replacement.                            |
| Saga compensation / restore batches       | **REMOVE** → fail-fast + resync           | Restores layout only while graph topology is already mutated; "compensated" state is a lie.                                    |
| Two-phase prepare/revalidate mutations    | **REMOVE** → validate once in transaction | No `await` between phases, no remote ingress, reentrancy already rejected. Nothing can interleave.                             |
| Empty-string token as valid owner         | **REMOVE**                                | Zero production constructors of `''`; three-state semantics (`undefined`/`''`/string) is accidental.                           |

## Phase 0 — Evict scope creep (do first; shrinks the diff before surgery)

1. `src/components/rightSidePanel/RightSidePanel.vue` + `RightSidePanel.test.ts`: move the active-tab microtask race fix to its own branch/PR. Not required by layout changes.
2. `src/components/rightSidePanel/errors/ErrorGroupList.vue`: drop the whitespace-only hunk (restore to base).
3. `src/AGENTS.md` (+5 policy lines): move to a separate guidance PR.
4. **KEEP in this PR**: all `nodeReplacement` changes (`useNodeReplacement.ts`, its test, `browser_tests/tests/nodeReplacement.spec.ts`) — real dependency; replacement previously bypassed layout registration.

Verification: `git diff --stat` no longer lists the evicted files.

## Phase 1 — Collapse two-phase mutations (layoutStore.ts)

Target: `src/renderer/core/layout/store/layoutStore.ts:817–955, 1224–1584`.

1. For each handler (move, resize, group bounds, z-index, visibility, node delete, reroute delete, batch bounds, reroute move): delete the prepare-time ownership/equality checks; keep a single validation inside `ydoc.transact`. Prepare only immutable metadata.
2. Keep the top-level `isApplyingOperation` reentrancy rejection.
3. Delete `PreparedMutation` plumbing if it becomes a passthrough.
4. Update `layoutStore.test.ts` expectations that asserted the prepare-time fast path.

Expected: ~200–300 production lines removed. Behavior identical for every reachable code path.

## Phase 2 — Replace saga compensation with fail-fast + resync (graphLayoutRegistration.ts)

Target: `src/renderer/core/layout/operations/graphLayoutRegistration.ts:34–130, 274–468, 952–992`; `LGraph.ts` teardown callers.

1. Remove: `pendingRegistrations` map, `registrationKey`, `reconcilePendingRegistration`, `reconcilePendingGraph`, `createRestoreLayoutOperation`, restore batches, `GraphLayoutDetach.includeGraph/restore`, `LayoutOperationError.applied`, aggregate compensation errors.
2. Reorder teardown so fallible lifecycle/extension callbacks run **before** authoritative store removal where feasible; store removal itself is a synchronous local Yjs transact that does not fail in practice.
3. Add one small recovery primitive: `syncGraphLayout(graph)` — upsert live nodes/groups/reroutes, remove stale exact-owned entries. Call it on unexpected teardown failure instead of compensating writes.
4. `registerScopedLayout`: replace pending-state protocol with `try/finally` cleanup at the call site.
5. Preserve: rejected-teardown aborting clear/configure (`LGraph.clearWithResult`), primary error propagation.

Expected: ~250–400 production lines removed. Log each removed mechanism in both ledgers.

## Phase 3 — Consolidate the ownership protocol

Target: `graphLayoutRegistration.ts`, `layoutMutations.ts`, `types.ts`, `layoutStore.ts`, `mappers.ts`.

1. **One lifecycle adapter**: extract an internal `ScopedRegistrationAdapter` (collection, ID field, create/delete op constructors, optional `beforeDelete`) and collapse the node/group/reroute attach/unregister triplets (`:511–567`, `:790–900`) into it. Public wrappers stay thin.
2. **Kill the third token state**: reject `''` as a token; semantics become `undefined` = legacy tokenless, non-empty string = owned. Consider a branded `LayoutRegistrationId` type; skip the brand if it ripples too far — the runtime reject is the point.
3. **Remove the legacy `rect` fallback** in `mappers.ts` (see decision record).
4. **Privatize test-only exports**: `registerNodeLayout`, `unregisterNodeLayout`, `registerGroupLayout`, `unregisterGroupLayout`, `registerRerouteLayout`, `GraphLayoutDetach` (post-Phase-2 remnant), and re-point their contract tests at the public attach/detach surface. Keep `getLayoutStoreYDoc` in `layoutStoreTestUtils.ts` only if remaining tests still need raw-doc access.
5. **Document the protocol once**: a single comment block or short `docs/` note at the top of `graphLayoutRegistration.ts` stating the ownership invariant, token creation/adoption/transfer rules, and what `undefined` means. This replaces the 19 implicit invariants with one written contract; the consolidation above should eliminate most of them structurally.
6. Defer (explicitly NOT in this PR): opaque lease-handle API from `layoutStore`, required-token operation type split. Record both in the pruned ledger as "reintroduce when multiplayer ingress lands."

Expected: ~100–200 production lines removed, export count from 28 down to ~10.

## Phase 4 — Test pruning

Targets: `layoutStore.test.ts`, `Reroute.store.test.ts`, `LGraphGroup.test.ts`, `LGraph.test.ts`, `mappers.test.ts`.

1. **Delete synthetic-failure tests** (5–8) that mock Yjs internals into impossible behavior: patched `Y.Map.set` throwing on `'size'`, partial-transaction mocks (`layoutStore.test.ts:936–1074`), `throw undefined` compensation variants (`LGraphGroup.test.ts:486–565` and node/reroute analogs). These test the mocks and the machinery Phase 2 deletes.
2. **Parameterize the triplets**: unregister-failure restoration, canvas-deselect rollback, retained-ownership-after-foreign-unregister, reentrant-unregister rejection — one table-driven contract suite over `{node, group, reroute}` adapters instead of three long copies each.
3. **Trim bookkeeping assertions**: tests asserting internal token/map contents (`layoutStore.test.ts:203–249`) collapse to one representative mutation + one delete.
4. **Collapse idempotence permutations** (`:393–452`, `:546–663`) into table-driven cases.
5. Keep untouched: stale-owner behavioral tests, node-replacement transfer tests, duplicate-ID tests, adoption tests, the two-doc merge test in `mappers.test.ts` (documents why the register split exists).

Expected: ~800–1,200 test lines removed, zero behavioral coverage lost.

## Phase 5 — Verification gates

Run after each phase, all must pass before the next:

```
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
pnpm test:unit src/renderer/core/layout src/lib/litegraph/src/LGraph.test.ts src/lib/litegraph/src/LGraphGroup.test.ts src/lib/litegraph/src/Reroute.store.test.ts src/platform/nodeReplacement
```

Final: full `pnpm test:unit`, targeted `pnpm test:browser:local browser_tests/tests/nodeReplacement.spec.ts browser_tests/tests/vueNodes/rerouteGeometry.spec.ts`, update the PR description (line counts, remove multiplayer framing — reframe as "stale-instance ownership safety"), and finish both ledgers.

## Order of execution

Phase 0 → 1 → 2 → 3 → 4 → 5. Phases 1 and 2 are independent and could parallelize, but both edit `layoutStore.test.ts` expectations — run sequentially to avoid conflict churn. Commit per phase with `refactor(layout):` prefixes.
