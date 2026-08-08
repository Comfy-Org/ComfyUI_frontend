# PR #14480 — Pruned Capability Ledger

Each entry: what was removed, why it could have been valuable, why it is not worth carrying now, and the concrete trigger that would justify reintroducing it. Update the Status column as remediation phases land.

| #   | Item                                                         | Removed from                                                           | Status                                                                  |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Prepare-time revalidation (two-phase mutations)              | `layoutStore.ts` (was 817–955, 1224–1584)                              | Done (Phase 1, −186 lines)                                              |
| 2   | Saga compensation / restore batches                          | `graphLayoutRegistration.ts:274–468, 952–992`                          | Done (Phase 2)                                                          |
| 3   | `pendingRegistrations` retry protocol                        | `graphLayoutRegistration.ts:34–130`                                    | Done (Phase 2)                                                          |
| 4   | `LayoutOperationError.applied` partial-failure reporting     | `graphLayoutRegistration.ts` / `layoutStore.ts`                        | Done (Phase 2)                                                          |
| 5   | Legacy `rect` register fallback                              | `mappers.ts` (`StoredNode.rect`, `yNodeGeometry`)                      | Done (Phase 3, commit 8f1237b467)                                       |
| 6   | Empty-string ownership token (`''` = valid owner)            | `layoutStore.ts`, tests                                                | Done (Phase 3, commit 48c046976e - `''` rejected at operation boundary) |
| 7   | Opaque lease-handle API (never built; deliberately deferred) | design only                                                            | Deferred                                                                |
| 8   | Required-token operation type split (owned vs legacy ops)    | design only                                                            | Deferred                                                                |
| 9   | Synthetic Yjs failure-injection tests                        | `layoutStore.test.ts:936–1074`, `LGraphGroup.test.ts:486–565`, analogs | Done (Phase 2 + Phase 4, commit 2bd515e538)                             |

## 1. Prepare-time revalidation (two-phase mutations)

- **Could have been valuable:** if remote Yjs updates could apply between preparing a mutation and committing it, re-checking ownership/values inside the transaction would prevent lost-update races. This is the correct shape for a truly concurrent document.
- **Why not now:** the layout `Y.Doc` is private with no provider; nothing can interleave between two adjacent synchronous statements in JS. Reentrancy is already rejected by `isApplyingOperation`. The duplicate checks were ~200–300 lines of pure overhead across nine mutation handlers.
- **Reintroduce when:** a Yjs provider / `Y.applyUpdate` ingress path lands and mutations can genuinely race remote transactions. At that point add the transaction-time recheck _once_, in a shared helper — not copy-pasted per handler.

## 2. Saga compensation / restore batches

- **Could have been valuable:** transactional teardown — if any step of graph/entity teardown fails, restore the CRDT layout entries so no geometry is lost. Correct instinct for a system where teardown can partially commit.
- **Why not now:** it never delivered the transactional guarantee. By the time compensation ran, links, reroute chains, node state, and extension callbacks had already mutated; restoring only layout entries produced a half-torn-down graph whose geometry merely _looked_ restored. The failure being compensated (observer/finalizer throwing mid-teardown after a successful Yjs write) has no identified production source. Replaced by reordering, not by a recovery primitive: released-subgraph layout teardown now runs in the final success-only teardown loop (after all fallible callbacks), so an aborted removal never needs restoration — nothing was unregistered yet. Direct single-entity restore around genuinely fallible extension callbacks (`onRemoved`, deselection) was kept; that is real callback rollback, not a saga.
- **Reintroduce when:** teardown spans genuinely fallible boundaries (async persistence, server acks) AND a single command handler owns both container lifecycle and layout lifecycle so compensation can be complete rather than layout-only. Partial compensation is worse than none.

## 3. `pendingRegistrations` retry protocol

- **Could have been valuable:** surviving a failed registration so a later pass can reconcile orphans — useful if registration were async or could fail transiently.
- **Why not now:** registration is synchronous; the pending state only persisted because `registerScopedLayout` lacked a `try/finally`. Only this one module ever produced or consumed pending entries. A call-site `try/finally` achieves the same cleanup with zero protocol.
- **Reintroduce when:** registration becomes async (e.g. awaiting server-assigned IDs) and transient failure with retry is a real state machine, not an artifact of missing cleanup.

## 4. `LayoutOperationError.applied` partial-failure reporting

- **Could have been valuable:** telling callers exactly which operations in a batch committed before a failure, so compensation could be precise.
- **Why not now:** its only consumer was the compensation machinery (item 2). Local synchronous Yjs transacts don't partially fail in any reachable way.
- **Reintroduce when:** batches can genuinely partially commit (async/remote application).

## 5. Legacy `rect` register fallback

- **Could have been valuable:** reading documents written before the position/size register split — standard schema-migration hygiene.
- **Why not now:** the document is in-memory only; it is never persisted or synced, so no pre-split data can exist anywhere. This was migration code for data that cannot exist.
- **Reintroduce when:** layout docs are persisted or exchanged with clients running the old schema. (Note: the position/size split itself was KEPT — cheap now, expensive to retrofit after persistence ships.)

## 6. Empty-string ownership token

- **Could have been valuable:** tolerating externally constructed operations that use `''` as a deliberate token — maximal input compatibility.
- **Why not now:** production tokens come exclusively from `createUuidv4()`; only tests constructed `''`. It created an undocumented three-state semantics (`undefined` = legacy, `''` = owned, string = owned) that every one of nine modules had to get right.
- **Reintroduce when:** never, ideally. If external operation sources appear, validate their tokens instead.

## 7. Opaque lease-handle API (deferred, never built)

- **Could have been valuable:** the cleanest fix for dual-authority registration — the store issues an unforgeable handle on create and requires it for mutation/delete, eliminating local/store token reconciliation.
- **Why not now:** worth doing, but it reshapes the public surface of `layoutStore` while we are trying to shrink this PR. Landing it inside a prune would mix a redesign into a reduction.
- **Reintroduce when:** the next layout-ownership PR, ideally alongside multiplayer ingress design.

## 8. Required-token operation type split (deferred, never built)

- **Could have been valuable:** making `registrationId` required-by-type on owned-entity operations removes the "optional in type, required in practice → silent no-op" trap.
- **Why not now:** same reason as 7 — a type-surface redesign, better done with the lease handle as one change.
- **Reintroduce when:** with item 7.

## 9. Synthetic Yjs failure-injection tests

- **Could have been valuable:** exercising failure paths that are hard to trigger naturally — mutation testing in spirit.
- **Why not now:** they patched `Y.Map.set`/`transact` into behaviors Yjs cannot produce (partial commits, per-key throws) and asserted the compensation machinery being deleted. They validated the mocks, violating the repo's "don't mock what you don't own" rule.
- **Phase 4 removals (commit 2bd515e538, −383 lines):**
  - `layoutStore.test.ts`: "preserves a foreign $map replacement at commit time" (transact patch injecting a foreign writer), "propagates a transaction failure and permits retry" (transact throw + retry), "returns no-op when beforeTransaction listeners delete/replace/make-equal the move target", "filters invalidated batch targets inside the transaction" (both mutate the doc from `beforeTransaction` — no production code subscribes to `beforeTransaction` at all).
  - `LGraphGroup.test.ts`: "rejects a layout inserted during group registration without deleting it" (throwing `beforeTransaction` listener), "preserves a foreign layout replacing an applied registration before failure" (transact patch + mid-registration foreign injection; its unique warn-path assertion is covered sequentially by "rejects an externally owned same-UUID group layout before mutation").
  - `Reroute.store.test.ts`: the two analogous fabricated tests, plus "retains subgraph reroute ownership when clear layout deletion throws" — replaced by a plain sequential test ("clears subgraph reroute registrations when the root clears") that keeps the one real behavior it proved.
- **What was kept:** all sequential ownership coverage (stale-instance writes, foreign-ownership no-op, duplicate creates, missing-target no-op, equal-value no-op, mixed-batch filtering), reentrancy-guard tests (listeners can genuinely reenter the store from observer callbacks; `beforeTransaction` is only the test's trigger hook there), and store-boundary mocks of `applyOperation` returning `rejected`/`no-op`/throwing — those exercise litegraph's rollback against the store's public contract, not Yjs internals.
- **Reintroduce when:** a real production callback can produce the failure mode — then test through that callback, not through patched library internals. If a Yjs provider ships, concurrent-writer tests belong at the provider ingress (`Y.applyUpdate`) boundary, which existing remote-projection tests already model correctly.

## 10. Explicit-token registration in unrelated test setup

- **Could have been valuable:** nothing beyond convenience; `registerGroupLayout(graph, group, 'literal-token')` in `ensureCorrectLayoutScale.test.ts` was just the closest-at-hand way to get a registered group.
- **Why not now:** it leaked the internal explicit-token API into a test about scale normalization, coupling that test to registration internals. `attachGroupLayout` is the production path and expresses the same setup. (Commit d2891fc4f5.)
- **Note on what was KEPT:** the explicit-token `register*/unregister*` exports remain, because the ownership-contract tests in `LGraphGroup.test.ts` and `Reroute.store.test.ts` genuinely test stale-token no-op behavior - the mechanism behind stale-instance protection. Privatizing them would have required rewriting those tests around double-instance choreography that obscures the contract being tested.
- **Reintroduce when:** n/a.
