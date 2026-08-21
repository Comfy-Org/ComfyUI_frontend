# Multiplayer workflow-document schema — v1

`SCHEMA_VERSION = 1`

> **State: DRAFT — awaiting FE sign-off (FE-1330).**
>
> Sign-off covers exactly three decisions; everything else in this document is
> derived from the frozen op vocabulary or from spike-verified behavior and is
> not up for FE re-litigation:
>
> 1. **Widgets as a name-keyed Y.Map** (§1.2) — not a positional Y.Array —
>    with the positional `widgets_values` array assembled only at projection
>    time from the pinned catalog widget order.
> 2. **`pos` ownership** (§2.4) — mint-time `pos` is frozen into `add_node`
>    ops and stored in the shared doc; live position dragging is view state
>    and belongs to the FE-owned layout Y.Doc, not this document. The FE must
>    confirm the split (which fields render from the shared doc vs the layout
>    doc, and the reconciliation rule when both exist).
> 3. **The replication contract** (§2) — ops are the replication unit for
>    edits; Yjs struct updates flow host→follower only. The FE client must
>    implement the "what a human editor must do" half of §2.4.

This document is the authoritative reference for the Y.Doc layout and op
semantics of `@comfyorg/comfy-multi-player`. It is versioned: a change to the
layout bumps `SCHEMA_VERSION` and requires a `migrate()` path (§10) plus FE
sign-off.

Normative inputs, in precedence order:

1. **The frozen op vocabulary** — comfy-cli `docs/op-vocabulary-v1.md`
   (branch `fix/validate-lowers-ui-to-api`, cite by commit SHA). Op kinds,
   envelope, stamp shapes, conflict rules, batch protocol. This document never
   contradicts it; where it is silent (storage layout, transport, projection),
   this document decides.
2. **The V1-007 spike** — `docs/spike-report-v1-007.md` (verdicts) and
   `fixtures/` (the evidence: three replayable sessions, six LWW vectors, the
   exported catalog, machine-captured findings). Every DECISION below cites
   the spike finding that forced it.

---

## 1. Doc layout

```
Y.Doc
├── Y.Map "nodes"        node_id (String) → per-node Y.Map          (§1.1)
├── Y.Map "links"        link_id (String) → plain link tuple        (§1.3)
├── Y.Map "definitions"  subgraph def id (String) → def Y.Map       (§5)
├── Y.Map "meta"         schema_version, catalog_version,
│                        last_node_id, last_link_id,
│                        groups, extra, config, version, …          (§1.4)
├── Y.Map "__applied"    op_id → 1                                  (§4)
└── Y.Map "__stamps"     write-target key → [base_version, actor, op_id]  (§4)
```

### 1.1 Per-node Y.Map

Keyed in `nodes` by `String(node.id)`. Fields:

| Key | Storage | Notes |
|---|---|---|
| `id` | plain | int (comfy-cli `mint_id()`, `[2^40, 2^53)`) or legacy string; compare with `String()` normalization |
| `type` | plain string | class_type, or a subgraph definition id |
| `pos`, `size` | plain `number[]` | mint-time values, frozen (§2.4) |
| `flags` | nested Y.Map | |
| `order`, `mode` | plain | execution order is node state and IS preserved (§7) |
| `properties` | plain object | passthrough |
| `widgets` | **name-keyed Y.Map** | widget name → value. See §1.2 — this is the load-bearing decision |
| `inputs` | Y.Array\<Y.Map\> | slot records `{name, type, link, widget?, grow_id?}`; autogrow appends carry `grow_id` (§8.3) |
| `outputs` | Y.Array\<Y.Map\> | slot records; `links` is a Y.Array of link ids, or `null` preserved verbatim (§7) |
| anything else | plain | passthrough, projected back verbatim |

### 1.2 DECISION: widgets are a name-keyed Y.Map, not a positional Y.Array

The spike measured two writers editing a KSampler's 7-element positional
`widgets_values` (`docs/spike-report-v1-007.md`, "danger zone"):
concurrent writes to the **same index**, exchanged as Yjs structs, merge to a
**length-8 array** — both inserts survive and every downstream widget shifts
by one, so `cfg` reads the steps value, `sampler_name` reads `8`, … The
corruption is silent and total for the node. Different-index concurrent writes
were safe; same-index was not, and same-index is exactly the LWW case the op
model must support.

Therefore v1 stores widgets as a Y.Map keyed by **widget name**:

- A `set_widget` apply is one map `set` (plus one `__stamps` set): bounded,
  structurally safe under any concurrency, and needs **no catalog at apply
  time** (the op already carries the widget name — the frozen vocabulary is
  name-addressed by design).
- The positional `widgets_values` array exists **only in projection** (§7):
  it is assembled from the name-keyed map using the widget order of the
  pinned catalog.
- Consequence, pinned: **the op model is not self-contained.** Widget
  name↔index resolution requires `object_info` (including dynamic-combo
  expansion driven by the node's current widget values, and autogrow
  element-naming templates). A consumer with a different catalog resolves
  different positions. Hence `meta.catalog_version` (§1.4): every document
  pins the object_info catalog version its projections are computed against.
  `fixtures/catalog.json` is the spike's export of exactly this data (10
  types: `widget_order` + `autogrow_templates`).
- Second consequence, pinned (V1-031 correction): **`add_node` needs the
  pinned catalog at apply time** whenever its `op.node` payload carries a
  non-empty positional `widgets_values` array — decomposing that array into
  the name-keyed map requires `widget_order`. The vocabulary doc's "no
  catalog is needed to apply an `add_node`" (§8.5 there) is true of Python's
  positional storage, not of this layout; the payload stays authoritative
  either way (values are never re-derived from the catalog, only re-keyed).

- Third consequence, pinned (Amendment A2): a class the pinned catalog does
  **not** describe has no `widget_order` and can never get one — the
  frontend-only `Note`/`MarkdownNote` are rendered by the frontend and never
  appear in `object_info`. Their non-empty positional `widgets_values` is
  stored **opaquely**, as one whole plain value under the reserved per-node key
  `__widgets_opaque`, and projected back verbatim. See Amendment A2 for why
  this does not reopen the corruption this section closed.

Note the residual conflict semantics: a name-keyed Y.Map fixes the
*structural* corruption, but Y.Map's native conflict pick is client-based,
not stamp-based (spike experiment 5: bob's write beat alice's higher stamp).
Stamp-correct LWW comes from the replication contract (§2), never from Yjs
merge behavior.

### 1.3 Links

`links` maps `String(link_id)` → the plain litegraph tuple
`[id, from_node, from_slot, to_node, to_slot, type]`. Stored as a plain value
(replaced whole on rewire): a link is created/retired atomically, never
field-edited, so there is nothing to merge inside one.

### 1.4 Meta

| Key | Semantics |
|---|---|
| `schema_version` | this document's version, set at mint, checked by `migrate()` (§10) |
| `catalog_version` | pinned object_info catalog identity (§1.2). Set at mint; changing it is a migration-grade event (projections change) |
| `last_node_id`, `last_link_id` | advisory high-water marks, max-register semantics (§8) |
| `groups` | plain value, opaque passthrough (§6) |
| `extra`, `config`, `version`, any other top-level workflow key | plain values, opaque passthrough (§6) |

`definitions` is **not** in meta — it has a first-class root map (§5). That is
a deliberate departure from the spike prototype, which parked definitions as
one plain JSON value in meta and thereby made every interior write an
unbounded whole-blob rewrite (the one flagged §6.2 violation).

---

## 2. Replication contract — the hybrid

This is the single most important constraint the spike surfaced, promoted to
contract:

> **DECISION: semantic ops are the cross-peer replication unit for every edit
> with LWW semantics. Raw Yjs update exchange is the transport for bootstrap,
> follower convergence, and presence — never a substitute for op application
> between independently-editing replicas.**

### 2.1 Why (spike evidence)

Convergence was proven for **op exchange**: two forked docs each applying
every op exactly once, in different orders (methodology: check c1 replayed
alternating causal prefixes; check c2 replayed 76/34/7 concurrency windows
with 105/42/6 concurrent ops across the three sessions) — projections came
out byte-identical every time, and all six `fixtures/lww-vectors.json`
vectors converge to the recorded winner in both orders.

The same edits exchanged as **raw Yjs struct updates** between two
independently-editing replicas demonstrably corrupt (spike experiments 2–3):
positional arrays grow (§1.2), and the `__stamps` bookkeeping itself merges
wrong — the *lower* stamp won the map merge because Yjs resolves Y.Map
conflicts by client id, not by stamp — so even future LWW gating is poisoned.
The stamp gate runs per-doc *before* a struct merge; it cannot referee one.

### 2.2 The v1 topology: single writing host, struct fan-out

- **Exactly one process mutates the shared doc's Y types: the doc host**
  (server-side merge consumer — the architecture the CLI already assumes).
  It applies every op through `applyOps`: idempotent by `op_id`, gated by
  `__stamps` with the total order `[base_version, actor, op_id]` (§3), so
  the surviving state is independent of arrival order even for concurrent
  stamps.
- **Yjs struct updates flow strictly host → follower.** Every client holds a
  follower Y.Doc kept current with `Y.applyUpdate` from the host's update
  stream. Because there is a single writer, Yjs's client-based conflict
  resolution never engages on op-covered state, and all followers are
  **byte-identical** to the host doc — not merely projection-equal.
- **Followers never write the shared doc.** No client-originated struct
  update is ever merged into it.

A future multi-writer topology (e.g. offline-capable peers) is permitted by
the convergence proof **iff ops remain the replication unit end-to-end**:
each replica applies each op exactly once through the applier, and struct
updates are never exchanged between two docs that applied ops independently.
Such replicas converge to projection-equality, not byte-equality. v1 does not
build this; it only refrains from making it impossible.

### 2.3 What travels on which channel

| Traffic | Channel | Unit |
|---|---|---|
| Edits (human and agent) | op channel, client → host | stamped op (frozen envelope) |
| Document state | host → follower struct stream | Yjs update |
| Bootstrap / reconnect catch-up | host snapshot + struct stream | `encodeStateAsUpdate` of the minted doc (§9) |
| Presence (cursors, selections, hover) | awareness protocol / ephemeral channel | awareness update — never persisted into the doc |
| View state (pan/zoom, live drag positions) | FE layout Y.Doc (separate document, FE-owned) | out of scope here (sign-off item 2) |

### 2.4 What each side MUST do (so two implementers cannot diverge)

**A human editor (FE client):**

1. Every edit that the op vocabulary can express — set a widget, add a node,
   connect, delete, clear — MUST be minted as a stamped op (actor
   `human:<user>:<tab>`, `op_id` = uuid4 hex minted client-side before
   dispatch, never re-minted on retry) and sent to the host. The FE MUST NOT
   mutate the shared doc's Y types directly, not even for its own edits.
2. The client renders from its follower doc. For latency hiding it MAY keep
   an **optimistic overlay**: its own pending ops applied to a local shadow.
   The overlay is presentation-only; a pending op is cleared when the op's
   effect arrives on the struct stream (or when the host acks it as
   LWW-dropped/rejected). Overlay state MUST never be encoded as a Yjs update
   and MUST never merge into the shared doc — that is exactly spike
   experiment 3.
3. Edits the vocabulary cannot express (group create/move/delete, live `pos`
   drags, pan/zoom) do not become ops. Groups are passthrough-with-clear
   (§6); positions and camera go to the layout Y.Doc (sign-off item 2).
4. Retry = resend the same op with the same `op_id`; the host's idempotency
   gate makes at-least-once delivery exactly-once per op.

**An agent / CLI writer:**

1. Already conforms: `workflow_ops` mints stamped ops (actor
   `agent:<thread>:<turn>`), and batches follow the abort-remainder protocol
   of the vocabulary doc §4. No change.

**The doc host:**

1. Applies every received op through `applyOps`, in arrival order, one
   transaction per op. Never regenerates `op_id`s, never reorders a batch's
   interior, never applies past a failed batch index (abort-remainder).
2. Dedupes by `op_id` (`__applied`), gates scalar writes by `__stamps` (§3),
   answers each op/batch with the applied/skipped/rejected accounting
   (`ApplyResult`), and broadcasts the resulting struct update to followers.
3. Owns bookkeeping compaction (§4) and snapshot minting (§9). It is the only
   process allowed to do either.

### 2.5 Convergence invariant (testable)

For any set of ops O and any two arrival orders o₁, o₂ at the host:
`project(apply(mint(base), o₁))` byte-equals `project(apply(mint(base), o₂))`.
This is the property the fixture suite pins (checks c1/c2 + the six LWW
vectors, both orders), plus the permutation suites of
`test/connect-lww.test.ts` and `test/stamp-target-identity.test.ts`.

**Three carve-outs, stated rather than implied** (Amendment A1; each is
pinned by a test that will start failing the day it is closed):

1. `outputs[].links` is a set projected as an ordered array, appended in
   arrival order. Two connects out of ONE source into two DIFFERENT inputs
   project the same set in two sequences. The SET converges; the byte
   comparison does not.
2. An autogrow `connect` grows a structural slot rather than writing a
   register, so racing a delete of its source leaves the grown slot present
   in one order and absent in the other. Two concurrent autogrows also
   assign their display names (`images.image1` / `images.image2`) by
   arrival — vocabulary §3 already says that ordering is the one decision a
   leaderless writer cannot make; comfy-cli's `canonical()` folds it out,
   `project()` does not.
3. Two `add_node` ops with the same `node_id` and different payloads resolve
   first-writer-wins by arrival. Vocabulary §1.1 rules this out by
   construction (`mint_id` draws 53-bit random ids), so it is a property of
   hand-authored or replayed streams only.

Everything else — including concrete-input contention, which used to be a
fourth, unstated carve-out — converges.

---

## 3. Stamps and LWW (imported from the vocabulary, with cross-language pins)

The stamp gate is the vocabulary's `_stamp_key` verbatim: a scalar write
applies iff `[stamp[0], stamp[1], op_id] > prior` elementwise — higher
`base_version` wins, ties break by `actor`, then by the unique `op_id`, so the
order is total and the winner is arrival-order-independent.

Pins the code does not state (spike report, "what the freeze doc must pin"):

1. **String comparison is by Unicode code point.** Python compares `str` by
   code point; JS `<` compares UTF-16 code units — they diverge above the
   BMP. Actor ids and op_ids MUST be ASCII (the frozen origin grammar and
   uuid4-hex already are); implementations MUST compare them bytewise.
2. **`op_id` format is uuid4 hex, 32 lowercase chars, minted by the creator
   before dispatch** — and it is the final LWW tiebreak, so op_id generation
   is load-bearing for conflict *outcomes*, not just dedupe.
3. **`add_node`'s `op.node` payload is authoritative.** Replay copies it
   verbatim; it is never re-derived from a schema (defaults drift).
4. Delete-wins is silent: an op whose target node is gone is a no-op that
   still consumes its `op_id`. Malformed/unknown ops are rejected loudly,
   never silently (vocabulary §3).

Write-target keys are the spike applier's, normative. **Gated and committed**
through `__stamps` (Amendment A1): the `set_widget` rows, the connect-embedded
`inputcount` bump (§8.3, which shares the connect's stamp), and a **concrete**
`connect`. The autogrow `connect` row and the `add_node`/`delete_node` rows
define conflict *identity* (for `detect_conflict`-style consumers) and reserve
the key shapes without gating — gating autogrow would silently discard one of
two concurrent, deliberately non-clobbering grows.

**Node ids in a target key are `String()`-normalized** (Amendment A1). `NodeId`
is `string | number` by contract and `nodesMap` is keyed by `String(node_id)`,
so a raw key gave `7` and `"7"` two registers for one node.

| Op | Target key | Gated? |
|---|---|---|
| `set_widget` (top-level) | `("widget", String(node_id), widget_name)` | yes |
| `set_widget` (interior) | `("widget", resolved_path, inner_widget)` — all three address forms normalize here (§5.2) | yes |
| `connect` (concrete slot) | `("input", String(to_node), to_slot)` | **yes (A1)** |
| `connect` (autogrow) | `("input", String(to_node), "grow", base_name)` | no — identity only |
| `add_node` / `delete_node` | `("node", String(node_id))` | no — identity only |

---

## 4. Idempotency & stamp bookkeeping — cost and the compaction rule

Two bookkeeping maps (§1 layout): `__applied` (op_id → 1, checked **before
any mutation** so a duplicate apply is a true no-op — spike-verified
byte-identical `encodeStateAsUpdate` after double-applying entire streams)
and `__stamps` (write target → winning stamp key).

**Measured cost:** ≈64 bytes/op; 10.3 KB of the 39.6 KB large-build doc
(26%) after only 162 ops. Growth is O(ops applied), forever. A structural
check cannot replace op-id tracking: LWW already makes `set_widget` re-apply
safe and payload-keyed identity makes `add_node`/`connect` nearly idempotent,
but `delete_node`/`clear` replayed after a re-add would destroy state — so
tracking stays mandatory.

**DECISION — the compaction rule (host-only, two mechanisms):**

1. **Per-actor watermarks.** The host assigns each op a per-actor contiguous
   sequence number `seq` at ingest (after op_id dedupe). `__applied` is then
   compactable to `actor → highest contiguous seq` plus a (normally empty)
   sparse set of out-of-order op_ids: O(actors) instead of O(ops). An
   incoming op at or below its actor's watermark is a duplicate by
   definition. Actors are session-scoped origin strings (vocabulary §7), so
   the actor set is bounded by session count, and watermark entries for
   actors idle past snapshot age are dropped at snapshot time.
2. **Snapshot compaction.** When bookkeeping exceeds **25% of doc bytes or
   10,000 `__applied` entries** (whichever first), the host mints a fresh doc
   from `project(doc)` — safe exactly because projection is total (§7) —
   carrying forward: `__stamps` entries for still-live targets, the actor
   watermarks, `catalog_version`, and the id high-water marks. The fresh doc
   is a new **doc epoch**: its bootstrap snapshot replaces the old one (§9),
   and followers resynchronize by full re-fetch (an epoch bump is a signal on
   the struct stream; followers MUST NOT merge cross-epoch updates).
   Ops minted against a pre-compaction `base_version` still apply — stamps
   survive compaction, so the LWW gate keeps functioning across epochs.

Until watermarks are implemented, the plain `__applied` map with rule 2 alone
is a conforming implementation (compaction bounds it); rule 1 is the target
state.

---

## 5. `definitions` — subgraphs are first-class

### 5.1 Layout (DECISION: bounded interior writes)

The spike flagged whole-`definitions`-blob rewrites as the one unbounded
write in the prototype (payload = the entire subtree for a single interior
widget edit), and as a false-conflict source (concurrent interior writes to
*different* subgraph nodes collide on the one blob). Fix: `definitions` is a
root Y.Map:

```
Y.Map "definitions"
└── def_id (String) → Y.Map
    ├── scalar/def-level fields   plain values (name, inputs, outputs, …)
    ├── "nodes"                   Y.Map — node_id → per-node Y.Map, the §1.1
    │                             schema applied recursively (incl. name-keyed
    │                             `widgets` maps)
    └── "links"                   Y.Map — link_id → plain tuple, as §1.3
```

An interior `set_widget` is then exactly one widgets-map `set` + one
`__stamps` set — bounded, and independently mergeable across different
interior nodes.

Interior ORDER, pinned (V1-031 correction): a definition's interior
node/link arrays are **not** sorted at projection — the §7 sorted-by-id rule
applies to the top-level arrays only. Python's `canonical` sorts
`definitions.subgraphs` by id but leaves each definition's interior arrays
in authored order, and the fixtures pin that (`session-subgraph`'s def lists
node 27 before node 3). Since only `set_widget` is subgraph-scoped, interior
membership and order are static after mint; the def Y.Map therefore stores
plain `node_order`/`link_order` registers (written once at mint) and
projection emits interior arrays in that order. Definitions themselves
project sorted by definition id.

### 5.2 Addressing: three forms, one write target

Only `set_widget` is subgraph-scoped in the frozen vocabulary (spike Q6;
error strings captured verbatim in `fixtures/findings.json`):

- `connect` structurally refuses interior endpoints ("a link cannot cross
  the subgraph boundary") and promoted-widget targets ("promoted widget (a
  value), not a link input").
- `add_node`/`delete_node` cannot address interior nodes at all.

`set_widget` accepts three address forms — flat promoted (`57.text`, routed
through the instance's `proxyWidgets`), nested interior (`57/3.steps`), and
the flattened UI→API alias (`57:3.cfg`). **The minted op carries the RESOLVED
`path` (e.g. `["57","27"]`) plus `inner_widget`** — replay needs no
proxyWidgets logic, and all three forms normalize to the single write target
`("widget", resolved_path, inner_widget)`. Spike-verified: a flat-form and a
nested-form concurrent write to the same interior widget LWW-converge
(vector `subgraph-flat-vs-nested`).

### 5.3 OPEN: shared-definition forking

When two instances share one definition, comfy-cli's engine deterministically
forks the definition on first interior write
(`engine._isolate_shared_subgraph`; fork id = `sha256(def_id, instance_id)`,
and the instance's `type` is rewritten to the fork id) — apply-time behavior
that changes the graph without an explicit op saying so. The spike fixtures
cover single-instance definitions only; the prototype does not implement
forking. **This stays OPEN**: the sha256 fork id is the candidate rule, but
it must be specced (and fixtured) as an amendment before multi-instance
definitions become editable. Until then a conforming applier MUST reject an
interior write whose head definition is shared by more than one instance.

---

## 6. Groups and `extra` — opaque passthrough, pinned exactly

The vocabulary has **no op** that creates, moves, or deletes groups; groups
and `extra` cannot be expressed in ops at all. Spike-verified: injected into
the base workflow, both survive the entire 162-op large-build stream
untouched and project back byte-identically.

Pinned semantics:

- `groups`, `extra`, `config`, `version`, and any unrecognized top-level
  workflow key are stored as plain values in `meta` and projected back
  verbatim. Implementations MUST NOT normalize, reorder, or re-type them.
- `clear` empties `nodes`, `links`, and — **only if the key already exists**
  — sets `groups` to `[]`. It does NOT touch `extra`, does NOT touch
  `definitions`, preserves `last_node_id`/`last_link_id` (id-reuse guard:
  a merge must never resurrect a deleted node's identity), and preserves
  `__stamps` (post-clear writes still LWW correctly).
- Collaborative group editing requires new op kinds (a vocabulary amendment),
  not a schema change; until then groups are passthrough-with-clear.

---

## 7. Projection — canonical form

`project(doc, catalog)` is a pure read producing ComfyUI workflow JSON;
`project(mint(w, catalog), catalog)` must deep-equal `canonical(w)`.

Canonicalization rules (all of them — the spike confirmed this list is
exhaustive for its corpus):

1. **Node and link arrays are sorted by id.** Y.Map is unordered; sorted-by-id
   IS the canonical order. Frontend insertion order (z-order/serialization
   order) is not representable and is declared non-semantic; the node's
   execution `order` field is node state and is preserved. Spike-verified:
   after sorting both sides by id, raw deep-equality holds for every session
   — no value, type, or key diffs.
2. **Widgets:** the name-keyed `widgets` map (§1.2) is emitted as the
   positional `widgets_values` array using the pinned catalog's
   `widget_order` for the node's type — including dynamic-combo expansion
   driven by the node's current widget values. Missing names project as
   `null` (Python pads with `None`). A node stored opaquely
   (`__widgets_opaque` — Amendment A2) emits its array verbatim and needs no
   catalog entry.
3. **Numbers serialize as JS numbers.** Python may emit `8.0` where JS emits
   `8`; the values compare equal but the bytes differ. Canonical JSON is the
   JS serialization; byte-level consumers MUST compare canonically, not
   textually against Python output.
4. **`outputs[].links: null` is preserved verbatim** (never coerced to `[]`);
   an empty Y.Array projects as `[]`. The distinction round-trips.
5. **Meta passthrough keys** project unmodified (§6).

---

## 8. Registers

### 8.1 `last_node_id` — max-register

Semantics: `last_node_id = max(last_node_id, node_id)` on every `add_node`.
A plain overwrite is arbitrary under concurrent adds; the pinned semantic is
max. In the v1 single-writer topology (§2.2) a compare-and-set at apply time
implements max exactly; any future multi-writer implementation must use a
proper max-register (write-if-greater with read-repair on merge). These
marks are **advisory high-water marks, never allocators** — ids come from
`mint_id()` (random 53-bit), leaderless and collision-free.

### 8.2 `last_link_id` — the pinned asymmetry

Python parity, pinned deliberately: `apply_op` bumps `last_node_id` on
`add_node` but **never bumps `last_link_id` on `connect`**. `last_link_id`
changes only at mint (seeded from the source workflow) and is preserved
across `clear`. Do not "fix" this asymmetry unilaterally — projections are
compared byte-wise against CLI-produced workflows, and diverging here breaks
replay fidelity.

### 8.3 The `inputcount` two-register autogrow op

The one op variant the spike prototype refused (`throw`) rather than
mirrored — pinned here so the applier ticket implements it before freeze:

A `connect` whose `grow.inputcount` is present (kijai `*Multi`-family nodes)
performs **two register writes under one op**: (a) the normal autogrow link
write — append an input slot keyed by `grow_id` = the op's `link_id`
(non-clobbering: concurrent grows both survive; collision renaming uses the
catalog's `autogrow_templates`), and (b) a **stamped widget write** of the
node's `inputcount` widget, sharing the connect op's `op_id` and stamp, with
the normal widget write target `("widget", to_node, "inputcount")`. One
`__applied` entry, two `__stamps`-relevant effects. Idempotency holds because
both halves key off the same op identity.

Deviation from Python, pinned (V1-031): comfy-cli skips the count write when
it has no catalog (`graph is None` — it cannot resolve name→index without
one). This layout's widget writes are name-keyed and need no index, so the
count write is unconditional here. Catalog-carrying hosts — the only
conforming deployment — behave identically under both implementations.

---

## 9. Bootstrap — one snapshot, all replicas fork from it

**Rule: every replica of a document forks from one common initial snapshot —
the host's `mint()` output, distributed as `Y.encodeStateAsUpdate` and loaded
with `Y.applyUpdate`. A replica MUST NEVER independently re-seed the same
base workflow.**

Why (spike finding, easy to hit and silent until merge): independently
re-minting the same base creates duplicate Yjs structs — Y.Array seeds double
their content on first merge. The correct fork is
`applyUpdate(new Y.Doc(), snapshot)`.

The snapshot is per doc epoch (§4): compaction mints a new snapshot and bumps
the epoch; cross-epoch struct updates never merge.

---

## 10. Versioning and `migrate()`

- `SCHEMA_VERSION = 1`, stored in `meta.schema_version` at mint.
- `migrate(doc, fromVersion)` contract: in-place, stepwise `vN → vN+1`
  migrations composed in order; exact no-op when
  `fromVersion === SCHEMA_VERSION`; host-only (followers receive the migrated
  doc via the struct stream / a new epoch); a doc whose `schema_version` is
  **greater** than the code's `SCHEMA_VERSION` is rejected, fail-closed —
  never best-effort read.
- Bumping `SCHEMA_VERSION` requires: a migration step, updated fixtures or a
  fixture-format note, an amendment section in this document, and FE
  sign-off (the layout is a cross-repo contract with the FE follower).

---

## 11. Op kind → bounded key writes (§6.2 conformance)

Y-level mutation counts measured by the spike's instrumented applier across
all three sessions (positional-widgets prototype; the name-keyed map (§1.2)
and first-class definitions (§5.1) only shrink these):

| Op kind | Y mutations avg / max | Bounded? |
|---|---|---|
| `add_node` | 2.1 / 3 | yes — one `nodes.set` + high-water mark |
| `set_widget` (top-level) | 3.8 / 4 → **2 under §1.2** (widgets.set + stamp) | yes |
| `set_widget` (interior) | whole-blob in prototype → **2 under §5.1** | yes (was the flagged violation; fixed by layout) |
| `connect` (concrete) | 4–5.2 / 7 | yes — bounded by the displaced link's source degree |
| `connect` (autogrow) | ~4 | yes — `grow_id` identity keeps replays non-clobbering |
| `delete_node` | 4.7–5 / 6 | yes — writes bounded by the node's degree; the dangling-reference *scan* is O(nodes) read cost, accepted |
| `clear` | O(doc) | **no — inherent.** Rare; standalone-only at the *authoring* surface (vocabulary §1.5: `apply_specs` rejects a spec batch containing it, code `workflow_clear_not_batchable`) — the *replay* surface (`apply_op` / `applyOps`, §4 abort-remainder) accepts it in any position and must, per `docs/portability.md`. SHOULD be host-mediated and never merged casually |

---

## Amendments

Post-v1 changes append `## Amendment v1.x — <date>` sections here; silent
edits to decided sections are not valid. The OPEN items eligible for
amendment: shared-definition forking (§5.3), group ops (§6), multi-writer
topology (§2.2), watermark implementation status (§4).

---

## Amendment A1 — 2026-08-12 — concrete-input contention; id-type identity

Tracks comfy-cli `docs/op-vocabulary-v1.md` **amendment v1.2**, cited by SHA:
`1201b676275ce7e9b5cdb90f135b6e115ba9df10` (branch
`kishore/v1-032-connect-lww`). This document and that one must move together;
read §11.1/§11.2 there for the normative rule, the rejected alternatives, and
the batch caveat. No `SCHEMA_VERSION` bump: the Y.Doc LAYOUT is unchanged —
only which targets `__stamps` gates, and how a target key spells a node id.

**Found by adversarial testing, not by review.** The cloud-side suite
(`services/agent/internal/dochost/adversarial_crdt_test.go`, PR #6722
FINDING 1) drove every order-preserving interleaving of two writers' causal
sequences through the REAL applier and caught §2.5 claiming a property the
code did not have. PR #6725 caught the id-type half the same way.

### What changed

1. **A concrete `connect` is stamp-gated** on `("input", to_node, to_slot)`,
   by the same `[base_version, actor, op_id]` comparison as `set_widget`
   (§3). Previously the occupant of a concrete input was decided by ARRIVAL
   ORDER, and composed with delete-wins that produced graphs where a link
   exists in one interleaving and not in another:

   ```
   A: [add_node 400, connect 400 -> 200.positive]
   B: [connect 300 -> 200.positive, delete_node 300]
   ```

   A-then-B left `positive` empty; B-then-A left link 9003.

   * The **winning** connect retires the prior occupant whole (`removeLink`:
     link tuple + the old source's out-link entry). The displaced link is
     deleted, never orphaned, never re-parented.
   * The **losing** connect is dropped whole — no link tuple, no slot write,
     no out-link entry — and still consumes its `op_id`, exactly like a
     losing `set_widget`.
   * The register claim is **unconditional once the gate passes** and happens
     BEFORE the source endpoint is resolved. A winning connect whose source
     was concurrently deleted therefore leaves the input EMPTY: delete wins
     over the new link, not over the register claim. Deferring the
     retirement until the link is known installable would make the
     incumbent's survival depend on when the delete arrived — the same class
     of bug, one layer down.
   * A stamp outlives the node it names; that is what makes the composed
     case converge, since a later lower-stamped connect is still dropped.
   * Autogrow stays UNGATED by explicit carve-out (§2.5 item 2).

2. **Node ids in target keys are `String()`-normalized.** `writeTarget` built
   its key from the raw id while the applier resolved nodes with
   `String(node_id)`, so `7` and `"7"` addressed one node through two
   registers and converged by arrival order. Interior writes already
   normalized (`path.map(String)`) and were unaffected; every case now
   matches them.

   This changes the BYTES of a `__stamps` key. `__stamps` lives only inside a
   live document, so this is not a data migration — but a document mid-flight
   across the upgrade loses prior claims for numerically-keyed targets and
   falls back to first-writer-wins on those targets until the next write.
   Consumers pinning this package by SHA must move the package pin and the
   vocabulary SHA together.

### Consumer impact

`services/agent/dochost` pins this package by commit SHA
(`package.json` + `package-lock.json`); the agent image pins comfy-cli
separately. Because the two implementations must agree on the same register,
**both pins move in the same change** — the applier first (it is the
document's authority), then the CLI.

---

## Amendment A2 — 2026-08-14 — opaque widgets for classes the catalog cannot describe

**Found in production, not in review.** `Note` and `MarkdownNote` are
frontend-only ComfyUI nodes: the frontend renders them, `object_info` never
lists them, so no catalog derived from `object_info` can ever carry a
`widget_order` for them. §1.2's decomposition then threw at mint, and **any
workflow containing a sticky note failed to mint** — most official templates
contain one. Downstream, the failure surfaced as a lie: the CLI had already
written the graph to its scratch file, so `ls_nodes` and `validate` reported a
healthy graph while `workflow_docs` held an empty document and the canvas had
zero nodes.

### The rule

When a node's `widgets_values` is a **non-empty positional array** and the
pinned catalog has **no `widget_order` for its class at all**, the array is
stored WHOLE as one plain value under the reserved per-node key
`__widgets_opaque`, and `project()` emits it back verbatim. No catalog lookup,
no re-keying, no padding.

Guarded narrowly — these three keep their existing behavior:

| Case | Behavior |
|---|---|
| `widget_order` present but SHORTER than `widgets_values` | still throws — a genuine catalog/workflow mismatch, never swallowed |
| empty `widgets_values` (`[]`) | unchanged: an empty name-keyed map, so key presence still round-trips |
| `applyOps` called with NO catalog at all | unchanged: `add_node` with positional values is still rejected `catalog_required`. A host with no catalog cannot tell an unknown class from an unseen one, so it does not guess |

### Why this does not reopen §1.2

§1.2 bans **element-wise merging of a positional array**. The spike measured
two writers editing the same index of a 7-element `widgets_values`, exchanged
as Yjs structs: the merge produced a **length-8 array**, every downstream
widget shifted, and `cfg` read the steps value. That corruption requires the
array to be a mergeable sequence with per-element identity.

An opaque value is a single plain value under a single key. It is never merged
element-wise; concurrent writes resolve as **whole-value LWW**. For an
annotation node whose content is one logical value, whole-value LWW is the
correct semantics rather than a compromise: two people editing one sticky note
should end with one of the two texts, not an interleaving of both.

What is genuinely given up is **name addressing**: an opaque array has no
name→position mapping, so a `set_widget` naming a widget on such a node cannot
be expressed. It is **rejected** (`opaque_widgets`), never silently dropped —
delete-wins silence is justified because the target no longer exists, whereas
here the target exists and the op is unsatisfiable, which §3 pin 4 puts in the
"reject loudly" bucket. Writing anyway would be worse than a lie: it would
create a name-keyed `widgets` map beside the opaque key and make **every**
later `project()` throw for the uncatalogued class. The same refusal covers the
§8.3 `inputcount` count-widget write, checked before the slot append so a
refused `connect` leaves the doc untouched.

### Rejected alternative: catalog entries for the frontend-only classes

Adding `Note: {widget_order: ["text"]}` (and one per frontend-only class) to
the catalog export would also make sticky notes mint. It was rejected: it is a
hand-maintained list that must track a frontend the catalog pipeline does not
read, and the next frontend-only node breaks production identically, in the
same silent way. `test/roundtrip.test.ts` guards the decision — it asserts the
corpus still carries `Note`/`MarkdownNote` **and** that the pinned catalog
still does not describe them, so adding those entries turns the regression
tests red instead of quietly vacuous.

### `SCHEMA_VERSION` is NOT bumped — the reasoning, for review

The layout gains a per-node key, which §10 would normally call a layout change.
It is not bumped because the change is **additive and unreachable in existing
documents**: `__widgets_opaque` can only appear on a node whose class is absent
from the catalog, and such a node could not be minted at all before this
change, so no live v1 document can contain the key and there is nothing to
migrate. Forward-compat holds (a new reader reads old docs unchanged);
backward-compat does not (an older reader projecting a newer doc would emit
`__widgets_opaque` as an unknown passthrough key and drop `widgets_values`),
which is the ordinary consequence of a SHA-pinned consumer moving its pin —
the same situation Amendment A1 documented.

### Consumer impact

`services/agent/dochost` pins this package by commit SHA. Repinning is a
deliberate, coordinated step across the branches that carry the pin; it is not
part of this change.
