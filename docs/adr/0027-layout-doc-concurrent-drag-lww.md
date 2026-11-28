# 27. KA-8 layout-doc concurrent-drag reconciliation = drag-end per-key LWW + awareness ghosting

**Status**: proposed — decision-ready; ratification staged as `s4-move-decision-1` in
`program/decision-queue.md` (merge-semantics policy calls are Christian's per DQ-11/DQ-15
precedent)
**Date**: 2026-08-29

## Context

KA-8 (`comfy-multi-player/docs/INVARIANTS.md:54-57`; root `AGENTS.md` KEEP-ALIVE 8) reserves
`pos`, pan/zoom, live drags, and groups for a separate FE-owned layout Y.Doc and demands that
"the split and reconciliation rule" be "stated explicitly" — and marks its own enforcement
**UNGUARDED**. The CRDT-RM-4 gap-closure packet
(`reports/audit/verify-crdt-rm-4-semantic-merge-gap-closure.md` §1 row "concurrent move", §3)
found no workspace artifact stating that rule and minted `s4-move-1` to write it. DQ-18
(resolved 2026-08-27) already routes geometry, groups, path reroutes, and cosmetic flags to
the KA-8 layout Y.Doc.

Code facts this rule is grounded on (cmp `8636af3e4`; FE `poc/fe-crdt-follower` @ `ea418dd70`):

- The semantic op catalog is frozen at `add_node | connect | set_widget | delete_node | clear`
  (`comfy-multi-player/src/types.ts:36` `FROZEN_OPS`). **No op mutates `pos`.**
- `pos` enters the shared semantic doc exactly once per node incarnation, verbatim, at
  `add_node` via `createNodeMap` (`src/applier.ts:498`, `src/doc.ts:752`), and is read back
  verbatim (`src/read.ts:308` `NODE_SNAPSHOT_KEYS`). It is creation-time placement intent,
  not a live-position register. Concurrent move is therefore _unrepresentable_ in the semantic
  doc today — by design.
- The FE follower's `move_node` graph mutation
  (`src/workbench/extensions/agent/crdt/graphMutations.ts`, `diffSnapshots.ts:75-76`,
  `litegraphMutator.ts:66`) is a one-way projection artifact: it re-renders a semantic-doc
  `pos` change (re-add / reset) into litegraph. Its only permitted source is `'agent-remote'`;
  it is not, and must not become, a live human-drag channel.
- Human drags today are litegraph-local runtime state; no CRDT write path for drags exists.
  The FE-owned layout Y.Doc is design-reserved (KA-8, DQ-18) but unimplemented.
- The doc-frame wire already carries an ephemeral `awareness` frame type
  (`docFrameClient.ts:45,164,191`), consistent with KA-7 (presence is ephemeral, never
  persisted into the doc).

## Decision

### The split, stated explicitly (what KA-8's text demands)

| Concern                                                     | Home                              | Merge semantics                                                                         |
| ----------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| Creation-time placement (`pos` at `add_node`)               | Shared semantic doc (cmp)         | Written once per incarnation, verbatim; whole-node LWW under duplicate-create per DQ-15 |
| Live node position after creation                           | FE-owned layout Y.Doc (per DQ-18) | Whole-value per-node register; this ADR's rule below                                    |
| In-flight drag positions (the node moving under the cursor) | Awareness channel only            | Ephemeral; never doc state (KA-7, KA-9, FORECLOSE 6)                                    |

### Reconciliation rule for concurrent drags of one node

1. **Committed positions merge by native per-key Yjs LWW.** The layout doc stores one
   register per node (`pos` as a whole `[x, y]` value under the node's key). Two replicas
   dragging the same node converge on the deterministic Yjs winner for that key regardless
   of update delivery order. Because this record has no physical drop-time clock, the
   physically later drop is not guaranteed to win. No smoothing, no averaging, no locks,
   no custom tiebreak.
2. **Drag-end commit is the only required write.** A drag writes its layout-doc register on
   drop (pointerup). Throttled intermediate commits are _permitted_ (they are ordinary LWW
   writes) but never required for correctness.
3. **In-flight drag positions travel on awareness, never in either doc.** Live ghosting of a
   peer's drag is presentation-only presence state, exactly as KA-9 treats the optimistic
   overlay.
4. **The semantic applier stays out of it.** No `move` op is added to `FROZEN_OPS`; cmp is
   untouched. The rule is enforced entirely at the FE boundary (the layout-doc writer
   module, when built).

### Enforcement locus

FE boundary, not cmp. When the layout Y.Doc is implemented, its writer module must land with
a follower-boundary-style check or unit tests asserting: (a) no semantic op kind writes
`pos` after `add_node`; (b) layout `pos` writes are whole-value registers committed at
drag-end; (c) in-flight positions flow only through awareness frames. That implementation
task must cite this ADR; on landing, KA-8's "Enforced by" line moves from UNGUARDED to
naming the guard (a cmp docs PR through cmp's normal review).

## Consequences

- KA-8's demanded rule now exists; the invariant remains UNGUARDED only until the layout-doc
  implementation lands its guard.
- Worst-case UX under concurrent same-node drags: the node lands at the deterministic
  Yjs-winning position — visible, comprehensible, immediately correctable by another drag.
  No divergence.
- High-frequency drag traffic never inflates semantic-doc history or Lamport clock churn
  (DQ-10/ADR-021): drags do not produce ops.
- Per `decisions/AGENTS.md`, this ADR must also be committed into the repo it governs —
  `ComfyUI_frontend/docs/adr/` — via that repo's normal review once ratified. Pending; the
  primary FE checkout is owned by a parallel agent this session.

## Alternatives Considered

- **(b) Soft ownership / drag lock via awareness lease** — first dragger claims the node;
  peers' drags refused or ghosted. Rejected: requires lease-timeout semantics, fails badly on
  disconnect mid-drag (node stuck locked), adds coordination to a hostless P2P path
  (FORECLOSE 2 adjacent), and contradicts the twice-stated "most pure crdt" preference
  (DQ-11, DQ-15 rulings).
- **(c) Positional smoothing / merge (e.g. averaging concurrent drops)** — rejected: produces
  a position neither user chose; not deterministic across replicas without extra state.
- **(d) Pull `pos` mutation into the semantic applier as a `move` op** — rejected: violates
  KA-8 and FORECLOSE 6, bloats semantic history with high-frequency presentation writes, and
  is explicitly out of scope per the RM-4 packet §1 and the `s4-move-1` task constraint.

## References

- `comfy-multi-player/docs/INVARIANTS.md:54-57` (KA-8), KA-7/KA-9; root `AGENTS.md`
  KEEP-ALIVE 7/8/9, FORECLOSE 6 (this workspace's invariant text)
- `reports/audit/verify-crdt-rm-4-semantic-merge-gap-closure.md` §1, §3 (pass 15)
- DQ-11, DQ-15, DQ-18 rulings (`program/decision-queue.md` §Resolved)
- cmp `8636af3e4`: `src/types.ts:36`, `src/applier.ts:498`, `src/doc.ts:752`,
  `src/read.ts:308`
- FE `poc/fe-crdt-follower` @ `ea418dd70`:
  `src/workbench/extensions/agent/crdt/{graphMutations,diffSnapshots,litegraphMutator,docFrameClient}.ts`
- Provenance: all sources are our own invariants, rulings, packets, and direct code audits.
  No Nathaniel design document was read or cited (COR-8 / `program/context-quarantine.md`).
