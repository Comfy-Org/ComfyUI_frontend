# CRDT / multiplayer invariants

This is the machine-addressable review log for the package. IDs are stable; do not renumber or silently weaken them.

## Three roles

- **Transport**: how bytes move (WebSocket / Redis PubSub / WebRTC). Cheap and swappable; P2P is a transport choice.
- **Merge authority**: the process that runs the applier/conflict resolution and whose result is canonical when edits race. Hard to change.
- **Persistence**: who writes snapshots to the DB. It may differ from merge authority; “SSOT in the DB” is a persistence statement, not an authority statement.

## KEEP-ALIVE

### KA-1 — Ops are the replication unit end-to-end
**Rule:** Between any two replicas that edited independently, exchange semantic ops, never raw Yjs updates.  
**Why:** Convergence holds iff independently edited replicas exchange ops.  
**Enforced by:** Reviewer profiles [`convergence-idempotency`](../.agents/checks/convergence-idempotency.md) and [`follower-boundary`](../.agents/checks/follower-boundary.md); architecture decision [ADR-002](decisions/ADR-002-ops-replication-unit.md).

### KA-2 — The ordering/identity key rides inside the op
**Rule:** `[base_version, actor, op_id]` is a total order any replica can evaluate offline; `op_id` is uuid4 hex minted by the creator before dispatch and never regenerated.  
**Why:** `op_id` is both the dedupe identity and final LWW outcome tiebreak.  
**Enforced by:** `test/ka2-stamp-inside-op.test.ts` across all four registers that consult `stampKey` — top-level `set_widget`, the interior subgraph path, the concrete-input register of vocabulary amendment v1.2, and the §8.4 inputcount pseudo-op — each in both arrival orders off one seeded snapshot, plus one assertion that decides the winner from the two ops alone with no `Y.Doc` in scope. `test/mutation-survivors.test.ts` also holds the property, but only at the top-level `set_widget` register; the §8.4 pseudo-op is held by nothing else, verified by mutation (rebuilding that pseudo-op's `stamp` from the envelope leaves the rest of the suite green). `test/lww.test.ts` and `test/stamp-target-identity.test.ts` pin the *comparator* and the *write-target identity*, not the in-op provenance of the key: every op they build has `stamp === [base_version, actor]`, which makes the two readings indistinguishable (AUD-MUT-1 R14). Also [`op-identity`](../.agents/checks/op-identity.md) for the `op_id` half.

### KA-3 — The op layer stays pure & portable
**Rule:** Applier, projection, and mint have zero DOM/framework/LiteGraph/server-only dependencies and run identically in browser and host; assert `yjs`-only directly, not merely by denylist.  
**Why:** A peer, edge, browser, and Node host must execute one implementation identically.  
**Enforced by:** `scripts/check-purity.mjs` (package level), `scripts/check-import-graph.mjs` + `.dependency-cruiser.cjs` rule `src-runtime-dep-is-yjs-only` (module-graph level, per source module), `test/purity.test.ts`, `test/parity.test.ts`, and [`purity`](../.agents/checks/purity.md). Cross-language implementations must pass the canonical golden vectors in `fixtures/golden-vectors/`.

### KA-4 — The applier is deterministic and idempotent
**Rule:** Same op-set + causal order gives the same projection; duplicate `op_id` is a true no-op with byte-identical `encodeStateAsUpdate`.  
**Why:** Retries and different legal arrival orders must not diverge replicas.  
**Enforced by:** `test/convergence.test.ts`, `test/connect-lww.test.ts`, `test/applier.test.ts`, and [`convergence-idempotency`](../.agents/checks/convergence-idempotency.md). Property coverage is tracked in #24.

### KA-5 — IDs are collision-free without coordination
**Rule:** Use 53-bit random mint; document high-water marks are advisory, never allocators; FE stable IDs must be non-colliding strings.  
**Why:** Offline peers must create entities without a central allocator.  
**Enforced by:** **UNGUARDED — see roadmap**.

### KA-6 — Raw struct updates flow host → follower one-way only
**Rule:** Followers never write the shared doc.  
**Why:** Reverse-flow Yjs structs from independently edited docs can corrupt or diverge state.  
**Enforced by:** [`follower-boundary`](../.agents/checks/follower-boundary.md) and [ADR-002](decisions/ADR-002-ops-replication-unit.md); runtime boundary enforcement is outside this package.

### KA-7 — Presence/awareness is ephemeral
**Rule:** Cursors, selection, and hover use the awareness channel and are never persisted into the doc.  
**Why:** Ephemeral UI state must not pollute semantic history or snapshots.  
**Enforced by:** [`follower-boundary`](../.agents/checks/follower-boundary.md); runtime channel enforcement is outside this package.

### KA-8 — Layout/view state is a separate FE-owned Y.Doc
**Rule:** `pos`, pan/zoom, live drags, and groups do not go in the shared semantic doc; state the split and reconciliation rule explicitly.  
**Why:** High-frequency presentation state has different ownership and merge semantics.  
**Enforced by:** **UNGUARDED — see roadmap; frontend-owned boundary**.

### KA-9 — Optimistic overlay is presentation-only
**Rule:** Pending local ops live on a shadow, clear on effect not ack, are never encoded as a Yjs update, and never merge into the shared doc.  
**Why:** Speculative UI state must not become canonical replication state.  
**Enforced by:** [`follower-boundary`](../.agents/checks/follower-boundary.md); runtime overlay enforcement is outside this package.

### KA-10 — Bootstrap/reconnect forks from ONE seeded snapshot
**Rule:** Use `applyUpdate` of a common snapshot; never independently re-seed the same base.  
**Why:** Independent Yjs struct identities can diverge despite identical JSON bases.  
**Enforced by:** `test/convergence.test.ts`, `test/lww.test.ts`, and `test/connect-lww.test.ts`.

### KA-11 — Schema-version discipline is enforced on read
**Rule:** Bump `SCHEMA_VERSION` when an old reader would mis-project a new doc; fail closed on unreadable schema and provide a `migrate()` path.  
**Why:** Readers must not silently mis-project an incompatible document.  
**Enforced by:** `test/roundtrip.test.ts` (the `migrate()` path) and `test/schema-version-on-read.test.ts` (the NORMAL read path). `project()` calls `assertReadableSchema` before it reads a single key, so a doc whose `meta.schema_version` is absent, unreadable, or NEWER than this package's `SCHEMA_VERSION` is refused with `SchemaVersionError` without a separate `migrate()` call — the fail-open gap #38 closed. Both entrypoints share ONE definition of the read (`readSchemaVersion`, `src/schema-version.ts`), pinned by the `classifies meta.schema_version = … as UNREADABLE on both entrypoints` cases, so they cannot drift into two notions of unreadable. The refusal is byte-exact and materializes no root type, matching `migrate()`; the no-materialization property is asserted on `[...doc.share.keys()]`, since an empty materialized root encodes to zero bytes and the byte assertion alone cannot see it. A3's carve-out carries over unchanged: a document whose `meta` root was integrated as a different concrete Y type surfaces Yjs's own constructor-clash `Error`, not a `SchemaVersionError` — still fail-closed, still a throw, but a consumer matching on the error TYPE must expect it. **Scope, stated because the wording invites the wider reading:** an OLDER doc is refused rather than silently migrated (migration is a host-only WRITE — schema §10, KA-6/FC-5 — while `project()` is a pure read every replica runs), but at `SCHEMA_VERSION = 1` no older doc exists to construct, so that arm is exercised through the module-only `assertSchemaVersionAgainst(doc, context, expected)` and NOT through `project()`. It is guarded, not yet guarded end-to-end.

### KA-12 — Catalog pinned at mint
**Rule:** `meta.catalog_version` cites the catalog by SHA, not branch; reject widget writes to uncatalogued classes loudly.  
**Why:** Replay semantics must not drift with a moving vocabulary.  
**Enforced by:** `test/roundtrip.test.ts`, [`catalog-pinning`](../.agents/checks/catalog-pinning.md), [ADR-003](decisions/ADR-003-catalog-sha-at-mint.md), and — for the *citations* rather than `meta.catalog_version` itself — `scripts/check-pins.mjs` (`npm run check:pins`) with `docs/upstream-pins.json` and `test/upstream-pins.test.ts`. The rule's second clause is narrower than it looks: **`meta.catalog_version` is still UNGUARDED at the write sites — see roadmap.** Neither `mint()` nor `initDoc()` rejects a branch-shaped catalog version; only the citations are linted.

## FORECLOSE

### FC-1 — Never exchange raw Yjs struct updates between independently edited docs
**Why:** This is the length-8 KSampler corruption path.  
**Enforced by:** [`follower-boundary`](../.agents/checks/follower-boundary.md) and [ADR-002](decisions/ADR-002-ops-replication-unit.md).

### FC-2 — Never make the server the only thing that can assign order
**Rule:** Server sequence must not be the sole conflict resolver beyond merely advancing `base_version`.  
**Why:** Sole server ordering kills hostless P2P ordering.  
**Enforced by:** `test/ka2-stamp-inside-op.test.ts` — its vectors make the in-op stamp and the envelope's server-assigned `base_version` name *different* LWW winners at every register that reads the key, so a collapse back onto the server scalar flips an assertion instead of going unnoticed; `envelopeWinnerDiffers` fails the test if a vector is ever weakened to one where the two readings agree. `test/mutation-survivors.test.ts` holds the same property for top-level `set_widget`. `test/lww.test.ts` pins the comparator only. Also [`op-identity`](../.agents/checks/op-identity.md).

### FC-3 — Never couple the applier/op layer to server-only or DOM/framework-only dependencies
**Why:** Such coupling prevents execution at a peer, edge, or browser and invites a second implementation.  
**Enforced by:** `scripts/check-purity.mjs`, `scripts/check-import-graph.mjs` + `.dependency-cruiser.cjs` rule `src-no-node-builtins`, `test/purity.test.ts`, [`purity`](../.agents/checks/purity.md), and [ADR-001](decisions/ADR-001-single-shared-applier.md).

### FC-4 — Never use full-document replace as the mutation primitive
**Why:** It increases ingress/egress, clobbers concurrent edits, and kills op-log replay and observability.  
**Enforced by:** [`convergence-idempotency`](../.agents/checks/convergence-idempotency.md); integration enforcement is outside this package.

### FC-5 — Never let a follower write the shared doc or merge an optimistic overlay back in
**Why:** Either path introduces an unauthorized independently edited update stream.  
**Enforced by:** [`follower-boundary`](../.agents/checks/follower-boundary.md).

### FC-6 — Never persist presence or put layout/view state in the shared semantic doc
**Why:** Ephemeral and presentation state do not belong to semantic replication.  
**Enforced by:** [`follower-boundary`](../.agents/checks/follower-boundary.md); runtime boundaries are outside this package.

### FC-7 — Never regenerate `op_id` on retry or resolve conflicts by client-id instead of stamp
**Why:** This poisons dedupe and future LWW gating.  
**Enforced by:** `test/lww.test.ts`, `test/applier.test.ts`, and [`op-identity`](../.agents/checks/op-identity.md).

### FC-8 — Never re-derive `add_node` payloads from a schema on replay
**Rule:** Copy payloads verbatim; defaults drift.  
**Why:** Replaying the same op against a changed schema must not change its meaning.  
**Enforced by:** `test/replay.test.ts` and `test/roundtrip.test.ts`.

### FC-9 — Do not permanently lock `base_version` to a server-assigned monotonic counter only
**Rule:** A scalar without causality is acceptable for V1 convergence, but leave room for a logical clock.  
**Why:** A permanent scalar ceiling prevents high-quality offline merge.  
**Enforced by:** [`op-identity`](../.agents/checks/op-identity.md); logical-clock evolution is **UNGUARDED — see roadmap**.

### FC-10 — Never cite the frozen vocabulary/catalog by moving branch instead of SHA
**Rule:** Every cross-repository citation names a commit SHA registered in `docs/upstream-pins.json` with the derivation that established it; the branch a pin replaced may be recorded as provenance but is never the citation. Moving a pin is a contract change — re-read the cited sections, reconcile the code, then move the registry and every citation together.  
**Why:** A moving reference causes silent contract drift. Observed, not hypothetical: the branch this package cited for the op vocabulary was deleted upstream on 2026-08-21 while three citations still named it, and two contract drifts reached this repository through it: the `reset_doc` deferred status (`docs/api-contract-proposal.md` Q5) and the batch-policy error codes (#19 — the pinned revision names one code, `workflow_clear_not_batchable`; the amendment already cited by SHA in Amendment A1 names two).  
**Enforced by:** `scripts/check-pins.mjs` (`npm run check:pins`, offline in CI; `-- --verify-remote` also proves each pinned SHA still resolves, each cited Markdown section still has its heading, and each cited Python symbol still has its definition, at that revision), `test/upstream-pins.test.ts`, [`catalog-pinning`](../.agents/checks/catalog-pinning.md), and [ADR-003](decisions/ADR-003-catalog-sha-at-mint.md).
