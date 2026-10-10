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
**Enforced by:** `test/public-api.regression.test.ts` (the package entrypoint exposes the op layer plus only ADR-004's three follower layout reads and KA-1's `encodingLosses` diagnostic — four names, and the guard's list is exactly those four; every other mutation helper stays private, and the follower is read-only by KA-6/FC-5) and `test/readonly-surface.test.ts` (the safer snapshot functions return deep-copied, deep-frozen plain data with no live `Y.AbstractType` at any depth); reviewer profiles [`convergence-idempotency`](../.agents/checks/convergence-idempotency.md), [`follower-boundary`](../.agents/checks/follower-boundary.md), and [`api-contract`](../.agents/checks/api-contract.md); architecture decision [ADR-002](decisions/ADR-002-ops-replication-unit.md). The schema §5.3 corollary — one op must not mutate N nodes through a shared subgraph definition — is held by `test/mutation-survivors.test.ts` (top-level instances), `test/promoted-host-writes.test.ts` (a NESTED promoted host write — Amendment A15's `instance_path` — resolves through the same guard, while a top-level host write never descends and is legal on a shared definition) and `test/doc-mint-mutation-survivors.test.ts` (instances reached from INSIDE another definition, and instances addressed by the definition's unique cosmetic NAME rather than its id). The name case was a live corruption bug until MUT-GLOB-KA4-1: `resolveDefinition` reaches a definition by id or by unique name, `countDefinitionInstances` matched the id string alone, so one definition instantiated under both spellings counted as ONE, the guard did not fire, and an interior `set_widget` mutated a definition backing two nodes while `applyOps` reported success. The count is now taken over the definition's resolvable aliases, so the guard's input and the resolver agree by construction — with one narrowing the first attempt missed: a display name the pinned catalogue describes as a node CLASS is not an alias, because naming a subgraph after the node it wraps is common (three shipped template workflows do) and counting those class nodes as instances rejected legal interior writes. A `nodes` entry that is not a `Y.Map` throws rather than being skipped, since skipping undercounts and makes this guard fail OPEN.

### KA-2 — The ordering/identity key rides inside the op
**Rule:** `[base_version, actor, op_id]` is a total order any replica can evaluate offline; `op_id` is uuid4 hex minted by the creator before dispatch and never regenerated.  
**Why:** `op_id` is both the dedupe identity and final LWW outcome tiebreak.  
**Enforced by:** `test/ka2-stamp-inside-op.test.ts` across all four registers that consult `stampKey` — top-level `set_widget`, the interior subgraph path, the concrete-input register of vocabulary amendment v1.2, and the §8.4 inputcount pseudo-op — each in both arrival orders off one seeded snapshot, and `test/promoted-host-writes.test.ts` for the two Amendment A15 registers — the promoted host write, which claims the top-level `set_widget` register `("widget", String(node_id), widget)` and is pinned to it by `stampTargetKey`, and the promoted `connect`, gated on `("input", to_node, "grow", name)` — each in both arrival orders, plus one assertion that decides the winner from the two ops alone with no `Y.Doc` in scope. `test/mutation-survivors.test.ts` also holds the property, but only at the top-level `set_widget` register; the §8.4 pseudo-op is held by nothing else, verified by mutation (rebuilding that pseudo-op's `stamp` from the envelope leaves the rest of the suite green). `test/lww.test.ts` and `test/stamp-target-identity.test.ts` pin the *comparator* and the *write-target identity*, not the in-op provenance of the key: every op they build has `stamp === [base_version, actor]`, which makes the two readings indistinguishable (AUD-MUT-1 R14). Also [`op-identity`](../.agents/checks/op-identity.md) for the `op_id` half.

### KA-3 — The op layer stays pure & portable
**Rule:** Applier, projection, and mint have zero DOM/framework/LiteGraph/server-only dependencies and run identically in browser and host; assert `yjs`-only directly, not merely by denylist.  
**Why:** A peer, edge, browser, and Node host must execute one implementation identically.  
Schema v3 added the first-class `__link_state` root; v4 adds `__clock_reservations`, keeping `__stamps` limited to winning write-target stamps. Private alpha has no compatibility reader: old layouts are re-minted, while `migrate()` refuses to relabel them.
**Enforced by:** `scripts/check-purity.mjs` (package level), `scripts/check-import-graph.mjs` + `.dependency-cruiser.cjs` rule `src-runtime-dep-is-yjs-only` (module-graph level, per source module), `test/purity.test.ts`, `test/parity.test.ts`, and [`purity`](../.agents/checks/purity.md). Cross-language implementations must pass the canonical golden vectors in `fixtures/golden-vectors/`. The current schema §1 root-map NAMES (`nodes`, `links`, `definitions`, `meta`, `__applied`, `__stamps`, `__link_state`, `__clock_reservations`) and the reserved per-node `__widgets_opaque`, `__incarnation` and (Amendment A24) `__widgets_form` keys are the shared wire layout. Before schema v3 added `__link_state`, the historical inventory was seven names: six roots plus that reserved widget key. Those seven were pinned by name in `test/doc-mint-mutation-survivors.test.ts`; every other reader in this package went through `nodesMap()`/`linksMap()`/… , so a consistent rename was invisible to most of the suite: measured one key at a time against the pre-existing tests, renaming `links`, `definitions`, `__applied` or `__stamps` left 277/277 green, while `nodes` reddened 2 and `meta` reddened 6. Four of those historical seven names had no holder at all before this file. The current nine names are additionally published as the language-agnostic vector `fixtures/golden-vectors/wire-layout.json` and held against the ENCODED bootstrap snapshot, against a replica that has only those bytes, and against this file and schema §1, by `test/wire-layout-contract.test.ts` — so a rename must move code, vector and both documents together, which is what makes a deliberate one visible in review. **Scoped, because the wording invites the wider reading:** that test does NOT force the `SCHEMA_VERSION` bump or the old-layout disposition KA-11 and schema §1/§10 require of a layout change. Its last case checks only that the three declarations of `SCHEMA_VERSION` agree with each other, and a rename applied consistently to all four places leaves them agreeing at 1 — measured, with that file fully green. The bump obligation is **UNGUARDED — see roadmap**; only its consistency once taken is held.

### KA-4 — The applier is deterministic and idempotent
**Rule:** Same op-set + causal order gives the same projection; an identical duplicate `op_id` is a true no-op with byte-identical `encodeStateAsUpdate`, while reuse with a different canonical payload is rejected without mutation.
**Why:** Retries and different legal arrival orders must not diverge replicas.
`test/permutation/duplicate-link-id.permutation.test.ts` enforces normalized link identity as one complete-tuple register across 12,288 bounded executions plus six language-neutral parity executions, including no dangling endpoints and no duplicate ownership. `test/disconnect-lww.test.ts` proves disconnect scrubbing normalizes the winning slot occupant's link identity and remains scoped to its concrete-input register when an unrelated link reuses the payload id.
**Enforced by:** `test/convergence.test.ts`, `test/connect-lww.test.ts`, `test/applier.test.ts`, `test/promoted-host-writes.test.ts` (Amendment A15: replay idempotency, both-order convergence for host writes and promoted connects, and byte-identical rejection for eleven malformed host-write shapes), `test/opid-payload-reuse.regression.test.ts` (changed-payload rejection, identical replay, legacy marker compatibility, canonical digest vector, and byte identity), `test/reject-no-mutation.regression.test.ts` (the rejection half: the `assertRejectedWithoutMutation`-driven cases assert `encodeStateAsUpdate` byte identity across a reject AND its retry, since a rejected op never records its `op_id`; a few further cases assert byte identity once without a retry; plus the op-only vectors in BOTH arrival orders on the source and destination axes, where the oracle is the projection or the disposition rather than the bytes — two replicas that applied the same ops in different orders hold different Yjs clocks legitimately), `test/ka4-storable-values.regression.test.ts` (Yjs storability pins, rejection/retry byte identity, and a generated hostile-op sweep), and [`convergence-idempotency`](../.agents/checks/convergence-idempotency.md). Property coverage is tracked in #24.

**Deliberate exceptions to clause 1, added by schema Amendment A6 (#34).** A `connect` refused by a check below a node's delete-wins return — `from_slot`/`to_slot` out of range or not addressing a slot record, an opaque widget destination, or a `grow.inputcount.widget` the catalogue cannot describe — racing that node's deletion resolves differently by arrival order, and under §4 abort-remainder that reaches the projection. The applier enforces that every precondition depending on the OP ALONE is checked before the delete-wins returns and does NOT carve out. The identical shape remains in `set_widget` and `resolveInteriorNode` — §2.5 items 6 and 8. Item 7's `add_node` carve-out is closed by Amendment A7: the node-presence stamp gate makes the same winner reach validation in either order. **The general rule, which §2.5 now states in place of a completeness claim: a rejection can be arrival-order-dependent either because its throw sits below an `op_id`-consuming document-dependent early return, or because its own verdict depends on mutable document state.** Every op-only precondition is hoisted above those returns and does not carve out. These deliberate deviations are logged in `docs/decisions/EXCEPTIONS.md`.

**Amendment A9 closes three residual write-order holes:** values that clone but cannot be stored by Yjs are refused before `set_widget`, grow, and `add_node` writes; `connect.link_id` must satisfy both Y.Map-value and Y.Array-item domains; and non-iterable `delete_node.removed_links` is refused before the A7 node-presence gate or deletion. **Amendment A10 closes the reference-cycle hole and corrects the shallow write predicate from storability to encodability:** `applyOps` rejects cycles at A8's whole-op depth gate, while the write-site cycle guard independently protects `mint`; top-level `Date` values are refused at the write gate, and `mint` refuses out-of-int64 `BigInt` values because Yjs accepts but does not faithfully encode them. **Amendment A13 classifies every BigInt in an op envelope as `malformed_op` during A8's op-only canonicalization precondition, names its payload path, and therefore rejects before any document write or `op_id` record.** **Amendment A14 shape-validates `connect.link_type` as a string in the op-only precondition, before destination delete-wins or any write; arbitrary and unknown strings remain legal because this is not catalogue membership validation.** **Amendment A11 bounds the remaining breadth and size attack surface:** batches are capped before processing, while A8's whole-envelope canonicalization now caps collection entries and an approximate cost covering strings, keys, binary bytes, containers, and leaves.

The *rejection* half — "a rejected op leaves the doc untouched", stated in the `applyOps` module docstring in `src/applier.ts` and repeated as contract D4 — is swept table-driven in `test/ka4-rejection-byte-identity.test.ts`, one row per reachable rejection code across `add_node`, `insert_workflow`, `set_widget`, `connect`, `connect`+grow, `delete_node`, `clear`, `reset_doc` and the envelope gate, asserting byte-identical `encodeStateAsUpdate` *and* that the `op_id` was not consumed. Completeness is enforced rather than asserted: one test compares the covered codes against `ALL_REJECTION_CODES`, and a second greps `src/applier.ts` for every `new OpRejectedError("…")` so a new code cannot be added without a row. `insert_workflow` adds collision refusals for nodes and links; both validate before any write. **The four `connect` rejections this used to except are fixed (#34)** and are now ordinary rows in that sweep, asserting byte-identity and `op_id`-preservation like every other code; the block that deliberately asserted the bug is deleted and `KNOWN_KA4_VIOLATIONS` is kept empty so a regression has somewhere to be recorded.

### KA-5 — IDs are collision-free without coordination
**Rule:** Use 53-bit random mint; document high-water marks are advisory, never allocators; FE stable IDs must be non-colliding strings.  
**Why:** Offline peers must create entities without a central allocator.  
**Enforced by:** `insert_workflow` derives every carried ID inside the applier from the immutable `op_id`, scope, kind, and raw ID (ADR-031); producers send raw workflows and perform no allocation against document state. General producer randomness remains **UNGUARDED — see roadmap**.

**Logged exception (2026-09-22, ADR-033; amended and ratified 2026-09-23):**
a link's derived id is the ONE carried-ID kind whose numeric type
this rule's "53-bit random mint" clause is worth stating explicitly for.
ComfyUI_frontend's `LinkId` is a branded `number`, unlike the
string-or-number `NodeId`, so `insert_workflow`'s usual pure string
derivation cannot satisfy it; `remap.ts`'s `derivedLinkId` mints a candidate
purely from the op's own content (SHA-256 of the ADR-031 seed, folded into
the full `[1, Number.MAX_SAFE_INTEGER]` range) with **no document read and
no retry** — an earlier revision retried against `doc.ts`'s
`persistedLinkIds`, which review found made link identity depend on local
arrival order (KA-2), so that retry and `persistedLinkIds` were both
removed. See `docs/decisions/EXCEPTIONS.md`'s KA-5 row and ADR-033's
"Amendment (2026-09-23)" section for the full reasoning, the quantified
residual collision probability, and the ratification record.

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
**Enforced by:** `test/convergence.test.ts`, `test/lww.test.ts`, and `test/connect-lww.test.ts` — all of which *follow* the rule (one `mint()`, forks via `applyUpdate`). None of them demonstrates the consequence of breaking it, so a change that made re-seeding look safe would not be caught here.

Two corrections recorded by MUT-GLOB-KA4-1, both measured on this tree rather than argued (an empty root type emits no structs; two mints of one base merge to per-key LWW), because the rule's stated rationale is not what the v1 layout actually does:
1. Seeding the root maps in `mint()`/`initDoc()` contributes **nothing** to `encodeStateAsUpdate` — an empty Yjs root type emits no structs, and a fork does not even carry the key until it is written. The five seeding calls in each function are therefore unobservable through the snapshot; the mutants that delete them are equivalent, not a coverage gap.
2. "Duplicate Yjs structs double on merge" is an ARRAY hazard. Because nodes and links are Y.Map-keyed by id, two independent `mint()`s of the same base merge to whole-value LWW at each key rather than doubling — verified, not assumed. The real re-seed hazard under this layout is silent whole-node clobber of a diverged replica's edits, which is not currently tested. **UNGUARDED — see roadmap.** `README.md` stated the doubling mechanism unscoped and has been corrected to match.

### KA-11 — Schema-version discipline is enforced on read
**Rule:** Bump `SCHEMA_VERSION` when an old reader would mis-project a new doc and fail closed on every non-current layout. Private alpha provides no compatibility migration.
**Why:** Readers must not silently mis-project an incompatible document.  
**Enforced by:** `test/roundtrip.test.ts`, `test/schema-version-on-read.test.ts`, `test/readonly-surface.test.ts`, and the 22 byte-identical old-layout refusal counterexamples retained by the schema-v3 integration. `project()` and `migrate()` share `readSchemaVersion`; both refuse old, absent, unreadable, or newer versions without mutation. Snapshot reads use the same predicate but return empty data for a document carrying no structs, as recorded by Amendment A12. Old private-alpha layouts are re-minted from source rather than relabelled.

Schema v4 adds the separate clock reservation root (schema A20 / ADR-021 CLK-3).
A v3 clock would miss those counters, so the layout is not silently extended.
`observedDocCounter()` also requires the current schema, even for an empty doc;
clock admission is not a follower's empty snapshot read. `test/clock.test.ts`
holds refusal of v1–v3, absent and future schemas without writes or relabelling,
and restart recovery from current-layout winning stamps and reservations.

Schema v5 adds occurrence-aware widget keys and LWW targets (schema A22). An
older reader would collapse or reject later same-name occurrences, so v1–v4
remain fail-closed and the host re-mints from source; followers do not migrate.

Amendment A24 adds the reserved per-node `__widgets_form` key WITHOUT a bump,
on A2's precedent and under A2's exact condition: the key is reachable only on
a node whose payload declared `widgets_values_form`, which no producer emitted
before A24, so no existing v5 document can contain it. That is the distinction
against A22, which bumped because it changed how already-reachable content (a
repeated widget name) was stored. Backward compat still does not hold — an
older reader emits the key as passthrough and mis-projects `widgets_values` —
which is the SHA-pinned-consumer consequence A1 and A2 both document, and why
the pins move in one coordinated step.

### KA-12 — Catalog pinned at mint
**Rule:** `meta.catalog_version` cites the catalog by SHA, not branch; reject NAMED widget writes to uncatalogued classes loudly. A subgraph instance's `type` is a definition UUID that no catalog describes, and its promoted widget values are POSITIONAL by frontend contract (ADR 0009), so a promoted host write (schema Amendment A15) is not a widget-name resolution and needs no catalog entry for the instance — it still needs A CATALOG (`catalog_required` without one) to tell an instance from an unseen class, and still refuses (`uncatalogued_widget_write`) to lay a positional array over named values the catalog cannot describe. A node that DECLARES its own ordered widget identity (`widgets_values_form`, schema Amendment A24) is resolved from that declaration and consults no catalog, which does not relax this rule: the clause bans this package GUESSING a name→position mapping it was never given, and a declaration is the mapping, supplied by the only party that knows it. An undeclared node keeps every refusal above, and `meta.catalog_version` still pins the catalog every other node projects against.  
**Why:** Replay semantics must not drift with a moving vocabulary.  
**Enforced by:** `test/roundtrip.test.ts`, `test/catalog-sha-binding-integration.test.ts`, `test/node-local-widget-form.test.ts` (A24's catalog-free path, and that an undeclared node still takes the catalogued one), [`catalog-pinning`](../.agents/checks/catalog-pinning.md), [ADR-003](decisions/ADR-003-catalog-sha-at-mint.md), and — for the *citations* rather than `meta.catalog_version` itself — `scripts/check-pins.mjs` (`npm run check:pins`) with `docs/upstream-pins.json` and `test/upstream-pins.test.ts`. `test/doc-mint-mutation-survivors.test.ts` additionally pins that an imported workflow cannot forge `catalog_version`/`schema_version` or any `__`-prefixed meta key, and that an unpinned mint records an EMPTY catalog version rather than a plausible-looking default (FC-10). The rule's second clause is narrower than it looks: **`meta.catalog_version` is still UNGUARDED at the write sites — see roadmap.** Neither `mint()` nor `initDoc()` rejects a branch-shaped catalog version; only the citations are linted.

### KA-13 — The package owns no state outside the caller's document
**Rule:** The package holds no caller-independent durable state: no module-level `let`/`var`, no module-level mutable collection, and no UI/reactivity/framework import. Every document is caller-owned and injected, so behavior must not depend on process lifetime or module-registry identity. There is exactly one documented exception — the `Y.Doc`-keyed `documentTransactionTails` weak registry of [ADR-021](decisions/ADR-021-doc-derived-lamport-clock-store.md) amendment CLK-2 — which is named in the gate's allowlist, keyed by caller-owned document identity, and creates no durable or cross-document state.  
**Why:** One implementation must run identically in a browser bundle, at a peer or edge, and in a bare Node doc-host serving many documents from one process, so restart and reconnect reseed from committed document state rather than package-owned persistence and two documents in one process cannot leak into each other. **This is not an alias of KA-3, and the overlap is the reason it reads like one:** KA-3 constrains the *dependency surface* (portability), KA-13 constrains *state ownership*. They coincide only on the framework-import ban, which is why `scripts/check-stateless.mjs` cites both and why the framework rules in the strict config are labelled `KA-3/KA-13`.  
**Enforced by:** `scripts/check-stateless.mjs` (`pnpm run check:stateless`), which lints every `src/**/*.ts` file against the `statelessRules` set in [`eslint.strict.config.js`](../.agents/checks/eslint.strict.config.js) under `CMP_STATELESS_ONLY=1` and then runs the colocated `test/stateless.test.ts` probe — no state shared between documents in one module instance, identical public behavior from fresh module registries, and a fresh Node process. The gate exits 2 (INCONCLUSIVE, never a pass) when a precondition or the per-file lint floor is missing, and it is merge-blocking in fact rather than by convention: [`.github/workflows/ci-comfy-multi-player.yaml`](../../../.github/workflows/ci-comfy-multi-player.yaml) runs it on every push and pull request. `test/invariant-ids.test.ts` holds this register itself — every `KA-*`/`FC-*` id cited anywhere in the package must resolve to a heading in this file, which is the guard that was missing while this entry was ([comfy-multi-player #152](https://github.com/Comfy-Org/comfy-multi-player/issues/152)).

### KA-11 amendment — DQ-11 incarnation namespace (historical schema-v2 context)
**Historical rule:** A node lifetime has a durable `__incarnation` token. Imported nodes use
`"0"`; a modern winning `add_node` carries its immutable `op_id` as the token
(legacy adds without the field remain life `"0"`). Node-scoped widget ops
carry that token, and `__stamps` keys include it. A write for a non-current
incarnation is a consumed no-op. The v1→v2 migration translates missing tokens
and legacy widget keys to life `"0"`. This records the schema-v2 amendment;
the current schema is v4 and does not run that migration for an old document.
Old private-alpha layouts are refused without mutation and source workflows
are re-minted, with no compatibility reader or relabelling path.

**Why:** A delete followed by same-ID re-add must not let a life-1 widget stamp
defeat a valid life-2 write (DQ-11, KEEP-ALIVE 4). The package regression is
`test/incarnation-stamps.test.ts`; the schema and protocol implications are
recorded in Amendment A16 of `docs/multiplayer-schema.md`.

### KA-2 amendment — DQ-10 direct Lamport counter semantics (historical schema-v2 context)
**Historical rule:** In the single private-alpha op format, `base_version` is minted as a
creator-owned Lamport counter. The winner remains the tuple-generic
`[counter, actor, op_id]`; DQ-11's A16 incarnation-qualified target keys and
the already-shipped legacy incarnation token `"0"` remain unchanged. At that
decision point there was no schema-v3, migration, legacy shim, or dual-format
reader. The current schema-v4 layout preserves the ordering decision but
refuses old layouts; it re-mints source workflows rather than providing a
compatibility reader or relabelling an old document.

**Enforced by:** `test/clock.test.ts`, the existing LWW/convergence suites, the
four-family merge harness, and [`ADR-0005`](adr/0005-lamport-ordering-v1-migration.md).

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
