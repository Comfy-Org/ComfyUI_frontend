# PR #14480 Remediation — Progress

Plan: `temp/plans/pr14480-remediation-plan.md`
Ledgers: `temp/summaries/pr14480-pruned-items.md`, `temp/summaries/pr14480-complexity-lessons.md`

## Phase 0 — Evict scope creep ✅ (commit dd87be07ea)

- [x] RightSidePanel.vue + RightSidePanel.test.ts evicted (patch: `temp/evicted/right-panel-tab-race.patch`)
- [x] ErrorGroupList.vue whitespace hunk reverted
- [x] src/AGENTS.md policy edit evicted (patch: `temp/evicted/agents-error-policy.patch`)
- [x] Verified: evicted files absent from `git diff --stat origin/feature/ecs-migration...HEAD`

## Phase 1 — Collapse two-phase mutations (layoutStore.ts) ✅

- [x] Prepare-time checks removed from all handlers; single transaction-time validation
      (`prepareOperation` → `executeOperation`, handlers return `boolean`, mutate directly)
- [x] `isApplyingOperation` reentrancy rejection preserved
- [x] `PreparedMutation` type, `markApplied` callback, and `firstPrepared` plumbing removed
- [x] layoutStore.test.ts: no changes needed — all 66 tests pass unchanged (132 across layout suite)
- [x] Gates: typecheck ✅ / lint ✅ / format ✅ / layout unit tests ✅ (132 passed)
- Net: −186 lines in layoutStore.ts (83 insertions, 269 deletions)

## Phase 2 — Fail-fast + delayed teardown replaces saga compensation ✅

- [x] pendingRegistrations, reconcilePendingRegistration, reconcilePendingGraph removed
- [x] Restore batches, GraphLayoutDetach.includeGraph, LayoutOperationError removed
      (GraphLayoutDetach.restore kept for direct single-entity callback rollback; no longer receives the error)
- [x] Released-subgraph layout unregister moved to the final success-only teardown loop in LGraph.remove —
      an aborted removal never unregisters anything, so no graph-wide restoration is needed
      (this replaced the planned `syncGraphLayout(graph)` recovery primitive; reordering made it unnecessary)
- [x] registerScopedLayout removed entirely — group/reroute registration creates entries directly;
      ownership weak maps set only after successful store creation, cleaned if application throws
- [x] applySnapshots propagates ordinary exceptions directly; finally-cleanup for isApplyingOperation
      and notification batching retained
- [x] Synthetic partial-failure tests removed from LGraph.test.ts, LGraphGroup.test.ts, layoutStore.test.ts;
      real callback rollback tests kept; misleading test renamed to
      'preserves subgraph graph and layout state when removal aborts'
- [x] Ledger entries 2–4 updated to Done; entry 9 marked Partial (Reroute.store.test.ts + one
      LGraphGroup.test.ts synthetic transact test remain for Phase 4)
- [x] Gates pass: typecheck ✅ / eslint ✅ / oxfmt ✅ / layout + LGraph + LGraphGroup unit tests ✅
- Net: −273 production lines (LGraph.ts +4/−10, graphLayoutRegistration.ts +71/−318, layoutStore.ts +14/−34),
  −502 test lines (LGraph.test.ts +5/−196, LGraphGroup.test.ts +2/−204, layoutStore.test.ts +3/−112)

## Phase 3 — Consolidate ownership protocol ✅

- [x] Registration records unified: node/group/reroute WeakMaps share `LayoutRegistration<TId>`
      `{ graphId, id, registrationId }` (commit 2682a9e311); no broad lifecycle abstraction added
- [x] `''` token rejected at applyOperation/applyOperations boundary; two-state semantics
      (`undefined` = legacy, non-empty string = owned) — commit 48c046976e
- [x] Legacy `rect` fallback removed from mappers.ts (node only; group rect intentionally kept) —
      commit 8f1237b467; migration tests removed, remote-projection test writes modern geometry
- [x] Test-only export usage narrowed: ensureCorrectLayoutScale.test.ts now uses production
      `attachGroupLayout` (commit d2891fc4f5). Explicit-token register*/unregister* exports KEPT —
      ownership-contract tests in LGraphGroup.test.ts / Reroute.store.test.ts genuinely test
      stale-token no-op behavior; privatizing would obscure the contract (ledger entry 10)
- [x] Ledger entries 5–6 updated to Done; 7–8 remain Deferred; entry 10 added
- [x] Gates pass: typecheck ✅ / eslint ✅ / oxfmt ✅ / focused layout tests ✅ (175 + 12 passed)

## Phase 4 — Test pruning ✅ (commit 2bd515e538)

- [x] Synthetic Yjs failure-injection tests deleted (ledger entry 9 → Done): −383 lines across
      layoutStore.test.ts (patched `Y.Doc.transact` throw+retry, foreign `$map` replacement,
      `beforeTransaction` delete/replace/make-equal interference, batch target invalidation),
      LGraphGroup.test.ts (foreign layout via throwing listener, mid-registration replacement),
      Reroute.store.test.ts (equivalent interleaving + synthetic transact throw during root clear)
- [x] Reroute root-clear test replaced with production-relevant sequential test:
      'clears subgraph reroute registrations when the root clears'
- [x] Entity foreign-layout tests parameterized (`as const` case tables in LGraphGroup/Reroute suites)
- [x] Kept: stale-owner, replacement transfer, duplicate-ID, adoption, real reentrancy/listener
      `beforeTransaction` tests, callback-failure rollback tests
- [x] Gates pass: typecheck ✅ / eslint ✅ / oxfmt ✅ / focused suites ✅
      (layoutStore 57, LGraphGroup 46, Reroute.store 53, LGraph 95 — 251 passed)

## Phase 4.5 — Regression found & fixed during validation

- [x] Clipboard regression from b2db253fbb (store-owned cleanup): pasted-subgraph reroutes pruned.
      Root cause: `registerLinkTopology(adoptExisting=true)` adopted persisted link state by link ID
      alone, but topology is bucketed per _root_ graph while subgraphs reuse internal link IDs — a
      pasted subgraph's link adopted the live subgraph's same-ID link (foreign endpoints), so the
      pasted reroutes looked orphaned and were removed.
      Fix: `hasSameEndpoints()` guard in `src/lib/litegraph/src/LLink.ts` — only adopt persisted
      topology when origin/target node+slot all match; otherwise register fresh.
      Caught by existing behavioral test `LGraphCanvas.clipboard.test.ts` (reroute id integrity).
      Recorded as complexity-lessons Lesson 10.
- [x] Layout-store mock updated: `withDeferredNotifications: vi.fn((cb) => cb())` — production
      `LGraph.add` now calls this API; canvas suites that mock the store failed without it.
- [x] Post-fix validation: clipboard + LLink.store (20 ✅), five canvas suites (42 ✅),
      focused core suites (251 ✅), typecheck ✅, targeted eslint/oxfmt ✅

## Phase 5 — Final verification & PR update

- [x] pnpm typecheck ✅
- [x] pnpm knip ✅ (rerun post-fix, clean)
- [x] git diff --check (committed + working tree) ✅
- [x] Changed-from-base run (`pnpm test:unit --changed origin/feature/ecs-migration`):
      9 failed / 9479 passed under full parallel load. In isolation, 4 of the 9 pass
      (widgetInputs, presetService, ColorWidget, GraphView-adjacent load timeouts); the
      remaining 5 failures (GraphView reconnect wiring, previewAny ×1, uploadAudio ×2,
      onboardingCloudRoutes ×1) reproduce **identically on the base branch**
      (verified via detached checkout of origin/feature/ecs-migration) — pre-existing,
      not attributable to this PR. Zero regressions from the remediation.
- [ ] Browser tests: nodeReplacement.spec.ts, rerouteGeometry.spec.ts (require running ComfyUI backend — not run locally)
- [ ] PR description rewritten (counts, reframed as stale-instance ownership safety)
- [x] Both ledgers finalized (pruned-items entry 9 → Done; complexity-lessons Lesson 5 Phase 4 addendum)

## Line-count tracking

| Checkpoint      | Production Δ       | Test Δ                                                          |
| --------------- | ------------------ | --------------------------------------------------------------- |
| Start (vs base) | +2,249             | +3,902                                                          |
| After Phase 1   | +2,063 (−186)      | +3,902 (unchanged)                                              |
| After Phase 2   | +1,790 (−273)      | +3,400 (−502)                                                   |
| After Phase 3   | +1,350 (−440)      | +3,435 (+35 vs Ph2; registration-record refactor touched tests) |
| After Phase 4   | +1,350 (unchanged) | +3,053 (−382)                                                   |

Final (vs base, incl. clipboard regression fix 9a52f98f88):
production +2,059 −687 (net +1,372); tests +3,442 −389 (net +3,053).
Total pruned from the original PR: −877 net production lines, −849 net test lines
(start +2,249/+3,902 → final +1,372/+3,053).
