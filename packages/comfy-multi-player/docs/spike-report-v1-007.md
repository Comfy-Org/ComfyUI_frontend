> **Archival note.** This is the V1-007 spike report, kept because
> `multiplayer-schema.md` cites it as a normative input — every schema DECISION
> names the finding that forced it. It is a **historical record of what was
> measured** and is deliberately not edited to match today's code.
>
> The prototype applier it describes (`applier.mjs`) has been **removed**: the
> production applier is `src/applier.ts` (V1-031). The prototype stored widgets
> positionally, which is the exact layout §1.2 of the schema rejects, so keeping
> a second, divergent applier in a production repo was a hazard rather than a
> reference. References to `applier.mjs` below describe the code as it was
> during the spike.
>
> **Provenance resolution (FC-10, added later.** The body below is unedited
> except for one inline `FC-10-historical` marker in the scope paragraph, which
> is what tells `npm run check:pins` that the dead branch name there is a
> preserved historical record rather than a live citation.**)**
> The scope paragraph cites the generator by the moving branch
> `pr511-reconcile`. That branch no longer exists: it was renamed to
> `fix/validate-lowers-ui-to-api` (comfy-cli PR #511) and deleted when the PR
> merged on 2026-08-21. The generator revision is established from
> `fixtures/MANIFEST.json`, which pins comfy-cli
> `7e732242d971daf0d2d30f22f997abfacd78986e` as the commit that produced these
> exact session files — not from the branch name. See `docs/upstream-pins.json`.
> Its "`workflow_ops._stamp_key`, lines 273–291" is a line-number citation into
> a file that has since grown: at the pinned commit `_stamp_key` is at line 315,
> and on comfy-cli `main` it is at line 340. Cite the symbol, not the line.

# V1-007 SPIKE report — CRDT schema validation against real op streams

Scope: validate the candidate Yjs schema by replaying team-authored op streams
produced by the real `comfy_cli.workflow_ops` primitives (branch
`pr511-reconcile`, prod `object_info.json` catalog from <!-- FC-10-historical: dead branch preserved as the spike's record; the revision is pinned in docs/upstream-pins.json -->
`services/ingest/data/`), through a prototype applier
(`applier.mjs`), against the exact convergence semantics of `apply_op`
(idempotency via `op_id`, delete-wins, stamp-LWW `[base_version, actor, op_id]`
per `workflow_ops._stamp_key`, lines 273–291).

All fixture sessions are team-authored (no prod data). Every session file is
self-verified at generation time: replaying its op stream from its base
converges (via `workflow_ops.canonical`) onto its recorded `workflow_final`.

## Verification results (a–e)

| Check | session-large-build (162 ops) | session-edit-heavy (61 ops) | session-subgraph (11 ops) |
|---|---|---|---|
| a. Replay fidelity (canonical) | PASS | PASS | PASS |
| b. Idempotency (byte-identical) | PASS | PASS | PASS |
| c1. Convergence, causal alternation | PASS | PASS | PASS |
| c2. Convergence, window concurrency | PASS (76 windows, 105 concurrent ops) | PASS (34 windows, 42 concurrent) | PASS (7 windows, 6 concurrent) |
| d. LWW parity (6 vectors) | PASS — all 6 vectors, both orders | | |
| e. Bounded writes | PASS with two flagged exceptions (below) | | |

Raw (non-canonical) deep-equality fails for every session for exactly one
reason: node/link array ORDER (see "Projection fidelity" below).

## Schema verdicts per op kind

Mutation counts are Y-level operations (map set/delete, array insert/delete)
counted by the instrumented applier across all three sessions.

| Op kind | Y mutations (avg / max) | Bounded? | Mapped cleanly? |
|---|---|---|---|
| `add_node` | 2.1 / 3 | yes | Yes. The op carries the full node payload (`op.node`); apply is one `nodes.set` + a `last_node_id` write. No schema needed at apply time. |
| `set_widget` (top-level) | 3.8 / 4 | yes | Mostly. 1 stamp write + array delete+insert (+ padding). BUT: name→index resolution requires the object_info catalog at apply time, and Y.Array index-writes are unsafe under struct-level concurrency (danger zone below). |
| `set_widget` (subgraph path) | 3 / 4 | **no** | **Flagged.** With definitions stored as one plain JSON value in `meta`, an interior write is a read-modify-write of the ENTIRE definitions blob — one Y mutation whose payload is the whole subtree. Violates the §6.2 bounded-writes rule in payload size, not op count. |
| `connect` (concrete slot) | 4–5.2 / 7 | yes | Yes. Link record set + input `link` set + output `links` append; replacing an occupied slot adds the old link's retirement (bounded by the old source's degree). |
| `connect` (autogrow) | ~4 | yes | Yes. Appends one input Y.Map keyed by `grow_id`; `grow_id` identity makes replay idempotent and non-clobbering exactly as in Python. The collision-rename fallback needs the schema's autogrow template (exported in `catalog.json`). `inputcount`-family grow (kijai `*Multi`) was NOT implemented or fixtured — it embeds a stamped widget write inside a connect and needs explicit spec treatment. |
| `delete_node` | 4.7–5 / 6 | yes | Yes. Node delete + link deletes + dangling-reference scrub. Scrub write-count is bounded by the deleted node's degree, but finding the dangling references requires scanning all nodes' inputs/outputs (read cost O(nodes); acceptable, worth noting). |
| `clear` | 34 / 34 | **no (inherent)** | O(doc): deletes every node and link key and empties groups. Inherently unbounded; fine as a rare op but the freeze doc should say a `clear` is O(n) and SHOULD be server-mediated rather than merged casually. Python preserves `last_node_id`/`last_link_id` and `_widget_stamps` across clear — mirrored, and it matters (id-reuse guard). |

## widgets_values-as-Y.Array under concurrent edits (the danger zone)

Measured with two writers on a KSampler's 7-element `widgets_values`
(`experiment-widgets-array.mjs`, results in `results-widgets-experiment.json`):

1. **Different indices concurrently** (A writes idx 0, B writes idx 4, then
   merge): converges correctly, length preserved. Safe.
2. **Same index concurrently, raw Y.Array delete+insert**: after merge the array
   is `[42, "fixed", "A-steps", "B-steps", 8, "euler", "normal", 1]` — length 8.
   Both inserts survive; every widget after the contested index shifts by one.
   Because the format is positional, this silently corrupts EVERY downstream
   widget on the node (cfg reads "B-steps", sampler_name reads 8, …), not just
   the contested one.
3. **Same index through the op applier, exchanged as Yjs structs** (each doc
   applies only its own op locally; the other side arrives by Yjs merge): the
   LWW gate cannot help — it runs per-doc before the merge. Same length-8
   corruption, and additionally the merged `__stamps` entry came out as
   `[3,"bob",…]` — the LOWER stamp won the stamps-map merge (Yjs Y.Map conflict
   resolution is client-based, not stamp-based), so future gating is wrong too.
4. **Same ops exchanged as OPS** (remote op re-applied through `applyOp`,
   i.e. an op-log / server-serialized path): correct in both orders — value 30
   (stamp `[5,alice]`) wins, length preserved, stamps correct. All session-level
   checks (a–d) run this way and pass.
5. **Alternative shape — widgets as Y.Map keyed by widget name**: concurrent
   same-key writes converge with no duplication and no shift, but the winner is
   Yjs's client-based pick (bob's 99 beat alice's stamp-5 write). Structure-safe
   but still not stamp-LWW.

Conclusion: **the convergence guarantees hold if and only if ops are exchanged
as ops** (each replica applies every op exactly once through the applier, in any
order). Exchanging raw Yjs struct updates between independently-editing
replicas breaks positional arrays (length growth) and breaks stamp-LWW (both
value and bookkeeping). This is the single most important design constraint the
spike surfaced.

## Groups / extra passthrough

`workflow_ops` has NO op that creates, moves, or deletes groups; groups and the
`extra` dict cannot be expressed in the op vocabulary at all. Injected into the
base workflow, both survive the entire 162-op large-build stream untouched, and
project back byte-identically (stored as plain values in the `meta` map).
`clear` empties `groups` (only if the key exists) but does NOT touch `extra` or
`definitions.subgraphs`. If multi-player needs collaborative group editing, the
vocabulary needs new op kinds; until then groups are opaque passthrough state
with clear-only semantics.

## Subgraph finding (Q6)

Subgraph-scoped ids ARE supported, but by exactly one op kind:

- `set_widget` accepts three address forms — flat promoted (`57.text`, routed
  through the instance's `proxyWidgets`), nested interior (`57/3.steps`), and
  the flattened UI→API alias (`57:3.cfg`). The stamped op carries the RESOLVED
  `path` (e.g. `["57","27"]`) + `inner_widget`, so replay needs no proxyWidgets
  logic, and all three forms normalize to ONE write target
  (`("widget", ("57","27"), "text")`) — verified: a flat-form and a nested-form
  concurrent write to the same interior widget LWW-converge (vector
  `subgraph-flat-vs-nested`).
- `connect` structurally refuses subgraph scope: an interior endpoint gets "a
  link cannot cross the subgraph boundary"; a promoted-widget target gets
  "promoted widget (a value), not a link input". `delete_node`/`add_node`
  cannot address interior nodes at all ("node 57/27 not found in workflow").
  Captured verbatim in `fixtures/findings.json`.
- NOT covered by fixtures (single-instance defs only): the deterministic
  definition-forking of shared subgraph definitions
  (`engine._isolate_shared_subgraph`, fork id = sha256(def_id, instance_id)).
  The prototype does not implement it. Any real implementation must, and the
  freeze doc must spec it — it is apply-time behavior that changes the graph
  (`instance.type` is rewritten to the fork id) without an explicit op saying
  so.

Schema gap: the candidate schema (`nodes`/`links`/`meta`) has no first-class
home for `definitions.subgraphs`. The prototype parks it as one plain JSON value
in `meta`, which makes every interior write unbounded (whole-blob rewrite) and
makes concurrent interior writes to DIFFERENT subgraph nodes false conflicts.
The real schema needs `definitions` as a Y.Map of subgraph-id → (Y.Map with its
own nodes map), i.e. the node schema recursively.

## Projection fidelity — normalizations needed

`project(doc)` output matches `workflow_final` under `workflow_ops.canonical`
for every session and every path (replay, c1, c2). Raw deep-equality requires
exactly one normalization:

- **Node and link array order.** Y.Map is unordered; projection imposes
  order-by-id. Python's workflow keeps insertion order. Verified this is the
  ONLY raw diff (sorting both sides by id makes them deep-equal — no value,
  type, or key diffs). Number-type drift (Python `8.0` vs JS `8`) does not
  surface as a diff because Python `==` treats them as equal, but it IS a
  serialization difference (`8.0` vs `8` in JSON text) that a byte-level
  consumer would see.
- Consequence: frontend insertion order (z-order/serialization order) is not
  representable in a Y.Map-of-nodes. The node's execution `order` field is
  preserved (it is node state), but array position is not. If array position
  matters to the frontend, the schema needs an explicit order structure; the
  cleaner call is to declare projection order (sorted by id) canonical.

## Idempotency tracking cost

Choice: a `__applied` Y.Map (op_id → 1), checked before ANY mutation so a
duplicate apply is a true no-op (verified byte-identical `encodeStateAsUpdate`
after re-applying all ops and the full stream twice). Y.Map over Y.Array
because concurrent duplicate appends to a Y.Array would both survive, while
concurrent sets of the same key converge.

Measured cost: `__applied` + `__stamps` ≈ 10.3 KB of the 39.6 KB large-build
doc (26%; 162 ops, 42 stamped targets; ≈64 bytes/op). It grows forever —
unbounded in session length. A deterministic structural check cannot replace it
for `set_widget` (LWW already makes re-apply safe) or `add_node`/`connect`
(payload-keyed identities make them nearly idempotent) — the hard case is
`delete_node`/`clear` replayed after a re-add, so op-id tracking (or a server
op-log watermark per actor, which is O(actors) instead of O(ops)) stays
necessary. Recommendation below.

## What the op-vocabulary freeze doc must pin that the code doesn't

1. **Transport semantics: ops are the replication unit.** Convergence is proved
   for op exchange (each replica applies each op once, any order). Raw Yjs
   struct-update exchange between concurrently-editing replicas is NOT
   equivalent and demonstrably corrupts positional arrays and stamp bookkeeping.
   The freeze doc must say which transport multi-player uses.
2. **Stamp comparison is cross-language.** `_stamp_key` relies on Python list
   comparison: `base_version` numeric, then `actor`, then `op_id` as string
   comparisons. Pin: actor and op_id compare by Unicode code point (ASCII-safe;
   JS UTF-16 ordering diverges from Python only above the BMP — constrain actor
   ids to ASCII or pin bytewise comparison).
3. **op_id format** (uuid4 hex, 32 chars) and that it is the LWW tiebreak —
   i.e. op_id generation is load-bearing for conflict outcomes, not just dedupe.
4. **Apply requires the schema catalog.** `set_widget` carries widget NAMES;
   name→index resolution happens at apply time against object_info
   (`widget_order_for_node`, including dynamic-combo expansion driven by the
   node's current `widgets_values`, and autogrow element-naming templates for
   connect collision renames). A merge consumer without the right catalog
   version resolves indices differently. Pin the catalog (object_info version)
   per document, or move storage to name-keyed widgets.
5. **`last_node_id`/`last_link_id` are advisory high-water marks** and need
   max-register semantics under concurrency: a plain Y.Map set of the max is
   arbitrary under concurrent adds. Also asymmetry to pin: `apply_op` bumps
   `last_node_id` on add_node but never bumps `last_link_id` on connect.
6. **`clear` scope**: empties nodes/links/groups; preserves `extra`,
   `definitions`, id high-water marks, and widget stamps.
7. **Subgraph semantics** (Q6 above): set_widget-only scoping, resolved-path
   normalization across the three address forms, and deterministic
   definition-forking for shared defs.
8. **`inputcount`-family connect** (`grow.inputcount`): a connect that also
   performs a stamped widget write sharing the connect's stamp/op_id — two
   registers written by one op. Currently only in code comments.
9. **add_node's `op.node` payload is authoritative** — replay must copy it
   verbatim, never re-derive from schema (defaults may have drifted).
10. **Bookkeeping growth**: `_applied_ops`/`_widget_stamps` (and their Yjs
    equivalents) grow O(ops)/O(targets) with no compaction story.

## What @comfyorg/comfy-multi-player should do differently from this prototype

1. **Widgets: name-keyed Y.Map per node, not positional Y.Array.** Eliminates
   the same-index duplication failure and the apply-time catalog dependency for
   widget addressing; projection assembles the positional array from the
   catalog's widget order. Positional alignment then becomes a
   projection-time concern only.
2. **Per-register LWW with read-repair, or server-serialized op log.** If
   replicas exchange struct updates, store `{value, stamp, op_id}` together per
   widget register and reconcile deterministically on merge (observe-deep +
   read-repair), because Y.Map's native conflict pick ignores stamps. If ops
   are server-serialized (single merge consumer applying the op log — the
   architecture the CLI already assumes), the prototype's gate is sufficient
   as-is; say so explicitly and keep struct-sync for read-only followers.
3. **First-class `definitions` subtree** (Y.Map of subgraph defs, nodes nested
   as Y structures) so interior writes are bounded and independently mergeable;
   implement deterministic definition-forking.
4. **Idempotency via per-actor op-log watermarks** (actor → last-applied seq)
   instead of an ever-growing op-id set, if ops get per-actor sequence numbers;
   otherwise budget for `__applied` growth and periodic doc compaction
   (snapshot + fresh doc, which is safe exactly because projection is total).
5. **Max-register for id high-water marks** (write-if-greater with read-repair
   on merge) or drop them from the live doc and compute at projection.
6. **Implement `inputcount`-family grow** before freezing; it is the only op
   variant the prototype refused (`throw`) rather than mirrored.
7. **Groups**: either add group ops to the vocabulary or pin groups as
   passthrough-with-clear semantics; the prototype's meta-blob treatment is fine
   only for the latter.
8. **Bootstrap protocol**: replicas must fork from one seeded doc
   (`applyUpdate` of a common snapshot). Independently re-seeding the same base
   workflow mints duplicate Y.Array structs that double content on first merge —
   easy to hit, silent until merge.

## Spike artifacts

```
crdt-spike/
├── gen_fixtures.py                    # fixture generator (runs via uv in ~/comfy-cli)
├── applier.mjs                        # Yjs prototype applier — the graduation draft
├── verify.mjs                         # checks a–e harness
├── compare_fidelity.py                # check (a), python-side canonical compare
├── experiment-widgets-array.mjs       # danger-zone experiments
├── results.json                       # a–e results + mutation stats
├── results-widgets-experiment.json    # danger-zone raw results
├── projections/                       # prototype projections (replay/c1/c2 × session)
└── fixtures/
    ├── session-large-build.session.jsonl   # 163 lines (header + 162 ops)
    ├── session-edit-heavy.session.jsonl    # 62 lines (header + 61 ops)
    ├── session-subgraph.session.jsonl      # 12 lines (header + 11 ops)
    ├── lww-vectors.json                    # 6 both-order convergence vectors
    ├── catalog.json                        # widget orders + autogrow templates (10 types)
    └── findings.json                       # machine-captured findings (incl. Q6 probe errors)
```

Fixtures + this report + `applier.mjs` are the durable outputs for
Comfy-Org/comfy-multi-player; everything else is throwaway harness.
