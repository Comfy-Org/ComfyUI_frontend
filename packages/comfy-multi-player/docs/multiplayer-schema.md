# Multiplayer workflow-document schema — v2

`SCHEMA_VERSION = 2`

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

1. **The frozen op vocabulary** — comfy-cli `docs/op-vocabulary-v1.md`, pinned
   at commit `7e732242d971daf0d2d30f22f997abfacd78986e`, plus amendment v1.2
   (§11) at commit `1201b676275ce7e9b5cdb90f135b6e115ba9df10` (Amendment A1
   below). Op kinds, envelope, stamp shapes, conflict rules, batch protocol.
   This document never contradicts it; where it is silent (storage layout,
   transport, projection), this document decides. Every `§n` this document
   quotes from the vocabulary is a section of the pinned revision — the earlier
   branch citation here has since been deleted upstream, which is exactly the
   FC-10 failure mode. `docs/upstream-pins.json` is the registry, records how
   each SHA was established, and lists the amendments upstream has added since;
   `npm run check:pins` holds this document and the registry to the same SHA.
   Moving a pin is a contract change: re-read the cited sections, reconcile the
   applier, then move the registry and every citation together.
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
| `__incarnation` | plain string | internal node lifetime token; never projected. Imported nodes use `"0"`; modern adds carry a creator token (normally their `op_id`), while legacy adds map to `"0"` |
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

- Fourth consequence, pinned (Amendment A15): a **subgraph instance** is
  exactly such a class — its `type` is a definition UUID that no `object_info`
  catalog will ever carry — and the frontend (ComfyUI_frontend ADR 0009) keeps a
  promoted widget's value on the instance as `widgets_values[i]`, POSITIONAL
  over the definition's widget-backed inputs. That array is A2's opaque
  storage, and a promoted host `set_widget` (carrying `promoted.value_index`) is
  a whole-value replace of it: one index written, never decomposed by name.

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

The normalized key is also a scalar link-identity register. Distinct `connect`
ops whose ids share `String(link_id)` contend on `("link", String(link_id))`;
the greatest embedded `[base_version, actor, op_id]` owns the complete tuple
and every coherent endpoint reference. See Amendment A18.

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

**Eight carve-outs, stated rather than implied** (Amendment A1, extended by
Amendment A6). Items 1, 2, and 4-6 are each pinned by a test that will start
failing the day it is closed; item 8 is pinned for
`shared_definition_unforked`, the shape no other item covers. Amendment A7
closes items 3 and 7 and the concurrent-display-name half of item 2. Read the RULE
below the list before concluding anything about a rejection that is not named
here:

1. `outputs[].links` is a set projected as an ordered array, appended in
   arrival order. Two connects out of ONE source into two DIFFERENT inputs
   project the same set in two sequences. The SET converges; the byte
   comparison does not.
2. An autogrow `connect` grows a structural slot rather than writing a
   register, so racing a delete of its source leaves the grown slot present
   in one order and absent in the other. ~~Two concurrent autogrows also
   assign their display names (`images.image1` / `images.image2`) by
   arrival~~ — **the display-name half is CLOSED by Amendment A7**: names and
   link tuple indexes are now assigned in stamp order without dropping either
   grow. The source-delete race above is still open.
3. ~~Two `add_node` ops with the same `node_id` and different payloads resolve
   first-writer-wins by arrival.~~ **CLOSED by Amendment A7**: node presence
   is LWW-gated on `("node", id)` and the winning op's payload is
   authoritative. Vocabulary §1.1 makes the collision rare by construction
   (`mint_id` draws 53-bit random ids), but delete-then-re-add reaches it on
   purpose, which is why it had to close. **A7 is not ratified yet — this is
   `api-contract-proposal.md` Q6 item 3.**

4. A `connect` whose `from_slot` is a non-negative integer but OUT OF RANGE
   for its source, or which addresses an element that is not a slot record,
   racing that source's deletion, is rejected by a replica that still holds
   the source and accepted as a register-claiming no-op by one that does not —
   "is 5 in range" is unanswerable once the source is gone. Amendment A6. The
   op-only half of the domain (integer, non-negative) is checked
   unconditionally and does NOT carve out.
5. The same shape on the DESTINATION axis. A `connect` rejected by a check that
   must read `to_node` — `to_slot` out of range or not a slot record, an opaque
   widget destination, or a `grow.inputcount.widget` the catalogue cannot
   describe — racing `delete_node(to_node)` is rejected by a replica that still
   holds the destination and accepted as a delete-wins no-op by one that does
   not. Under §4 abort-remainder the two replicas then also disagree about the
   REST OF THE BATCH, which makes this a projection divergence and not merely
   an `__applied` one. Amendment A6. As on the source axis, every OP-ONLY
   precondition is checked before the delete-wins return and does NOT carve
   out; only the checks that must read the destination do.

6. The same shape in `applySetWidget`. `if (!node) return` (and the interior
   path's `resolveInteriorNode(...) === null` return) are delete-wins no-ops
   that consume the `op_id`, and `rejectIfOpaqueWidgets`, `validateWidgetName`
   and the `widget_out_of_range` check all READ the node, so they sit below
   them. A `set_widget` refused by any of those, racing its target's deletion,
   is rejected by a replica that still holds the node and applied as a no-op by
   one that does not; under §4 abort-remainder that reaches the projection.
   Measured. Amendment A6.
   Amendment A15's promoted host write has the same shape: `hostWriteStorage`
   (opaque vs named, `catalog_required`, `uncatalogued_widget_write`) reads the
   instance and sits below `resolveInteriorNode(...) === null`; the payload's
   shape checks (`promotedHostWrite`) are op-only and hoisted above the gate.
7. ~~The same shape used to recur in `applyAddNode`: structural idempotency
   returned before payload validation.~~ **CLOSED by Amendment A7.** The
   node-presence stamp gate makes the same winner reach validation in either
   arrival order, so the abort-remainder outcome now converges. The former
   still-diverges pin is now a positive convergence assertion.

   A reference cycle is not a convergence carve-out either. **CLOSED by
   Amendments A8/A10:** `applyOps` rejects it at the whole-op depth gate before
   any write, and A10 additionally guards every write site so `mint()` cannot
   create a permanently unencodable document. The former `it.fails` cycle pin
   is a positive rejection-and-recoverability assertion. **Amendment A14**
   closes the `connect.link_type` shape hole before any document write while
   deliberately accepting arbitrary strings.

8. `resolveInteriorNode`'s own rejections — `not_a_subgraph`,
   `shared_definition_unforked`, `interior_node_not_found` — all read the
   document and all sit below the interior delete-wins return, so an interior
   `set_widget` refused by any of them resolves differently by arrival order.
   **`shared_definition_unforked` does not even need a deletion**: it flips
   verdict when a concurrent `add_node` raises the definition's instance count,
   so under §4 abort-remainder a trailing op in the same batch survives on one
   replica only. Measured. Amendment A6.

**The rule these come from, which is more useful than the list.** A rejection is
arrival-order-dependent when **whether it is raised at all depends on document
state**. That happens two ways, and the first version of this paragraph got both
of them wrong by saying "exactly when the CHECK reads the document":

- **The throw sits below a document-dependent early return that consumes the
  `op_id`** — a delete-wins return or the interior null return. A replica in a
  different state takes the return and never reaches the throw. **What the check
  itself reads is irrelevant — only WHERE IT SITS.** The sharpest example is
  `connect.link_id`: #59 added a write-site check that reads NOTHING BUT THE OP
  (now the A10 `arrayItemRefusal`/`mapValueRefusal` encodability check), and it
  still resolves differently by arrival order, because it sits below the
  destination delete-wins return. An op-only check in the wrong position is
  exactly as order-dependent as a document-reading one — which is why
  `requireOpOnlyValid` is about POSITION, not about what is read.
- **The check's own verdict is computed from document state a concurrent op can
  change.** `shared_definition_unforked` (item 8) needs no deletion and no early
  return: `countDefinitionInstances` returns 1 or 2 depending on whether a rival
  `add_node` has been applied yet.

**The direction that IS a guarantee**, and the one Amendment A6 buys: a
precondition that depends on the OP ALONE and is evaluated before any document
read cannot be arrival-order-dependent by either mechanism. That is what
`requireOpOnlyValid` is for, and it is why hoisting is the fix rather than
wrapping. The converse does not hold — do not read "the check reads only the op"
off a rejection code and conclude anything about where the check runs.

Under §4 abort-remainder any order-dependent rejection also decides whether the
REST OF THE BATCH applies, which is how a bookkeeping difference becomes a
projection difference.
Every precondition that depends on the OP ALONE is hoisted above those returns
and does NOT carve out.

**Items 1-8 are illustrative of that rule, not an exhaustive enumeration of it.**
This list has been extended three times in one review, each time by someone
probing a handler nobody had probed yet, and treating it as complete is what made
each of those omissions look like a contradiction rather than a gap. If you need
to know whether a specific rejection converges, apply the rule and measure both
arrival orders; do not conclude "it is not in the list, therefore it converges".
Everything that satisfies neither mechanism — including concrete-input
contention, which used to be an unstated carve-out of its own — converges.

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
`connect`; and, since **Amendment A7** (issue #11), the `add_node` /
`delete_node` / per-removed-node `clear` rows. A1 left node presence ungated,
which resolved it by arrival order: `delete`→`add` kept the replacement while
`add`→`delete` kept nothing, and a `clear` deleted or spared a concurrent
`add_node` depending only on which arrived first. Under A7 the winning op's
payload is authoritative for the node (§3 rule 3), so both orders agree.

The autogrow `connect` row stays **ungated** — gating it would silently
discard one of two concurrent, deliberately non-clobbering grows. A7 instead
makes autogrow *canonical*: the grown slots of one family are ordered by their
op stamps, and slot names and link tuple indexes are assigned from that order,
so concurrent grows land on the same names in either arrival order without
either grow being dropped.

**Node ids in a target key are `String()`-normalized** (Amendment A1). `NodeId`
is `string | number` by contract and `nodesMap` is keyed by `String(node_id)`,
so a raw key gave `7` and `"7"` two registers for one node.

| Op | Target key | Gated? |
|---|---|---|
| `set_widget` (top-level) | `("widget", String(node_id), node_incarnation, widget_name)` | yes |
| `set_widget` (interior) | `("widget", resolved_path, node_incarnation, inner_widget)` — all three address forms normalize here (§5.2) | yes |
| `set_widget` (promoted host write, A15) | `("widget", String(node_id), node_incarnation, widget_name)` — `node_id` is the instance id, or the joined `instance_path` (`"57/61"`) for a nested host; the SAME register a top-level named write on that node claims (comfy-cli `_write_target`) | yes |
| `connect` (concrete slot) | `("input", String(to_node), to_slot)` | **yes (A1)** |
| `connect` (autogrow) | `("input", String(to_node), "grow", base_name)` | no — identity only, canonicalized by stamp (A7) |
| `connect` (promoted input, A15) | `("input", String(to_node), "grow", name)` with the FULL declared name (names may contain dots — `images.image0`), matching comfy-cli `_write_target` at amendment v1.5 (`ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`); only an ordinary autogrow keys by base name | **yes (A15)** — one register named by the definition |
| every `connect` (link identity, A18) | `("link", String(link_id))` | **yes (A18)** — greatest stamp owns the complete tuple and coherent endpoint references |
| `add_node` / `delete_node` (presence) | `("node", String(node_id))` | **yes (A7)** |
| `clear` (one row per entry in `removed_nodes`) | `("node", String(node_id))` | **yes (A7)** |
| `delete_node` (severance of the link ids in `removed_links`) | none | no — monotonic, ungated (A7) |

---

## 4. Idempotency & stamp bookkeeping — cost and the compaction rule

Two bookkeeping maps (§1 layout): `__applied` (op_id → payload digest,
checked **before any mutation** so a duplicate apply is a true no-op —
spike-verified byte-identical `encodeStateAsUpdate` after double-applying
entire streams) and `__stamps` (write target → winning stamp key).

**Amendment A8 (issue #12): `__applied` records a digest of the op's
canonical payload, not `1`.** `op_id` is minted by the creator and is also
the final LWW tiebreak (§3 rule 2), so an `op_id` collision changes *who
wins*, not merely whether a write dedupes. Gating on `op_id` presence alone
pushed a reuse with a **different** payload to `skipped` with `failed: null`
and silently dropped its write; `decisions/ADR-007-op-based-crdt-v1.md` had
already ruled that out ("existing `op_id` accepted only if canonical bytes are
identical … reused with differing payload/stamp = protocol violation, rejected
without mutating state"). On an `op_id` hit an applier MUST compare digests
and reject with `op_id_reuse` on mismatch; an identical replay stays a
byte-identical skip.

The recorded value is `sha256(canonical(op))` as 64 lowercase hex characters,
where `canonical(op)` is the op object serialized as JSON with **every object
key sorted by code point at every depth**, array order preserved, whole
envelope including `op_id`, and the digest taken over that string's UTF-8
bytes. Because `__applied` is replicated, every implementation MUST produce
the same digest for the same op or a legitimate retry is rejected across a
language boundary; `test/opid-payload-reuse.regression.test.ts` pins the
canonical string AND the digest of a representative op as the cross-language
vector, and `test/digest.test.ts` pins the implementation against a
stdlib SHA-256. Note the residual hazard a digest does not remove: JSON number
formatting and lone-surrogate escaping are not identical across languages, so
the canonical form is only well-defined for payloads that round-trip through
JSON — which the frozen vocabulary's payloads do.

A value of `1` is a pre-A8 record: it is accepted as a duplicate and skips the
comparison, so documents written before A8 keep working. **No `SCHEMA_VERSION`
bump.** The layout is unchanged — `__applied` was always op_id → opaque
marker, and §7 excludes `__`-prefixed maps from projection, so an older reader
projects a newer document identically. Forward-compat holds (a new reader
treats an old `1` as "cannot compare, accept"); backward-compat degrades only
in conflict detection (an older reader ignores the digest and accepts a reuse),
which is the behavior it had anyway.

**Canonicalization is bounded.** It walks attacker-controlled payload, and it
runs on the duplicate path, which previously short-circuited before reading
the payload at all. Nesting deeper than 64 levels is rejected with
`payload_too_deep` before any mutation; without the bound, anyone who knew one
already-applied `op_id` could force a stack-exhaustion `RangeError` and abort
the remainder of the batch (issue #14). The size/cost half of #14 is still
open.

**Measured cost:** the pre-A8 map was ≈64 bytes/op; 10.3 KB of the 39.6 KB
large-build doc (26%). Recording the canonical payload verbatim was measured
at ~326 bytes/op (the whole 162-op large-build doc goes 45.7 KB → 98.6 KB,
bookkeeping 16% → 58%), which crosses the 25% compaction trigger below after
roughly forty ops and turns every crossing into a doc-epoch bump and a full
follower re-fetch — the ingress/egress blow-up FC-4 exists to prevent, reached
through the bookkeeping map instead of through full-document replace. The
digest is a fixed 64 characters regardless of payload size: re-measured on the
same session it costs ~112 bytes/op, taking `__applied` to 18.2 KB and the doc
to 56.0 KB (bookkeeping 16% → 32%). That is still above the 25% trigger, so
compaction remains load-bearing and #12's fix does not make it optional — but
the doc grows 13% rather than 116%. A structural check
cannot replace op-id tracking: LWW already makes `set_widget` re-apply safe and
payload-keyed identity makes `add_node`/`connect` nearly idempotent, but
`delete_node`/`clear` replayed after a re-add would destroy state — so tracking
stays mandatory.

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
   from `project(doc)` — safe because projection is total over the documents
   a host holds: it refuses a whole document only when the schema version is
   unreadable (§7 rule 0) or the catalogue pin is violated (§3 pin 4), neither
   of which is a state a host can be compacting from, and it drops individual
   entries only per §7 rule 6 —
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

**Superseded for PROMOTED widgets by Amendment A15** (comfy-cli PR #815, pinned
at `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`). The flat form `57.width` no
longer resolves into the definition: it is a HOST write carrying
`promoted: {value_index, instance_path, host_widgets_values}` and no `path`, and
an interior address that backs a promotion (`57/13.width`) is redirected to the
same host write at mint time (`redirected_from`). What still arrives here as a
`path` write is an UNPROMOTED interior widget (`57/3.cfg`). The host register
`("widget", "57", "width")` and the interior register
`("widget", ["57","13"], "width")` are different registers and are deliberately
not unified — see A15.

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
- **Amendment A7 (issue #11): `clear.removed_nodes` is the authoritative
  target set.** It records the node ids present at mint time; an applier MUST
  NOT re-derive the set from its own live `nodes` map when the list is empty,
  because that reads arrival-dependent state and made a `clear([])` remove or
  spare a concurrent `add_node` purely by arrival order. Each listed id passes
  the `("node", id)` LWW gate individually, so a higher-stamped concurrent add
  survives the clear. Links are then removed **iff an endpoint is no longer
  present**, the same rule `delete_node` uses, rather than being wiped
  wholesale; when `removed_nodes` covers the whole graph this is identical to
  emptying `links`. A `clear` whose `removed_nodes` is empty therefore removes
  nothing — an empty list means the minting replica saw an empty graph.
- Collaborative group editing requires new op kinds (a vocabulary amendment),
  not a schema change; until then groups are passthrough-with-clear.

---

## 7. Projection — canonical form

`project(doc, catalog)` is a pure read producing ComfyUI workflow JSON;
`project(mint(w, catalog), catalog)` must deep-equal `canonical(w)`.

**Rule 0, which runs before any of the rules below (Amendment A5, §10).** The
first thing `project()` does is refuse a document whose `meta.schema_version`
this package cannot read — absent, not a positive integer, or a version other
than `SCHEMA_VERSION`. That refusal is a WHOLE-DOCUMENT `SchemaVersionError`,
it precedes the per-entry dispositions in rule 6, and it precedes the
catalogue check in §3 pin 4. A reader of this section alone would otherwise
conclude `project()` never refuses a whole document.

Canonicalization rules (all of them — the spike confirmed rules 1-5 exhaustive
for its corpus; rule 6 was added by Amendment A4):

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
6. **A nodes-map entry that cannot be READ is skipped** (Amendment A4): the
   entry is not a `Y.Map`, or its `widgets` slot is not a `Y.Map`. Exactly
   those two — every other shape projects verbatim under §1.1 passthrough,
   including a mistyped `flags`/`inputs`/`outputs`, a blank or absent `type`,
   and an `id` disagreeing with its map key. Neither skipped state is reachable
   through `mint`/`applyOps`. A skipped entry does **not** survive the §4
   compaction re-mint, so widening this rule deletes data and needs its own
   amendment. Catalogue-contract violations are NOT skipped and still throw
   (§3 pin 4).

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

- `SCHEMA_VERSION = 2`, stored in `meta.schema_version` at mint.
- `migrate(doc, fromVersion)` contract: in-place, stepwise `vN → vN+1`
  migrations composed in order; exact no-op when
  `fromVersion === SCHEMA_VERSION`; host-only (followers receive the migrated
  doc via the struct stream / a new epoch); a doc whose `schema_version` is
  **greater** than the code's `SCHEMA_VERSION` is rejected, fail-closed —
  never best-effort read.
- **Refined by Amendment A3**: the read gate runs on every path (including the
  current-version one), an unreadable `meta.schema_version` is rejected rather
  than assumed current, and "exact no-op" is defined at the byte level. Read A3
  for the normative rule and for what this deliberately stopped checking.
- Bumping `SCHEMA_VERSION` requires: a migration step, updated fixtures or a
  fixture-format note, an amendment section in this document, and FE
  sign-off (the layout is a cross-repo contract with the FE follower).
- **The version check is on the READ path, not only on `migrate()`.**
  `project(doc, catalog)` refuses — `SchemaVersionError`, before it reads any
  key — a document whose `meta.schema_version` is absent, unreadable (not a
  positive integer), or not equal to this package's `SCHEMA_VERSION`. Nothing
  forces a caller through `migrate()`, so a gate that lived only there was a
  gate a low-context host could skip, and an old reader would best-effort
  project a new document (KA-11).
  A document OLDER than the reader is refused too, not migrated in place:
  migration is a host-only write, `project()` is a pure read available to every
  replica, and a follower that writes the shared doc breaks KA-6/FC-5 outright
  and becomes an independently edited replica, which is the FC-1 raw-struct
  divergence path. The caller runs `migrate(doc, storedVersion)` first, then
  reads. The refusal is byte-exact and materializes no root type, the same as
  `migrate()`'s — asserted on `[...doc.share.keys()]`, since an empty
  materialized root encodes to zero bytes (A3).
  Both entrypoints share ONE definition of the read, `readSchemaVersion` in
  `src/schema-version.ts`; `migrate()` holds no private copy. See Amendment A5.
- **Refined by Amendment A12**: there is a THIRD read path — the snapshot
  surface, `src/read.ts` — and its refusal is CONDITIONAL. It refuses a
  document that carries content under a schema this package cannot read, and
  returns its empty value for a document that carries nothing. Read A12 for
  why the condition exists, for the one document class where its disposition
  differs from `project()`'s, and for the constraint it puts on how "carries
  content" may be asked.

---

## 11. Op kind → bounded key writes (§6.2 conformance)

Amendment A18 adds exactly one `__stamps` mutation to every successful
`connect`; the autogrow liveness case therefore moves from seven to eight
Y-level mutations and from two to three stamp rows.

Y-level mutation counts measured by the spike's instrumented applier across
all three sessions (positional-widgets prototype; the name-keyed map (§1.2)
and first-class definitions (§5.1) only shrink these):

| Op kind | Y mutations avg / max | Bounded? |
|---|---|---|
| `add_node` | 2.1 / 3 → **3.1 / 4 + degree under A7** | yes — one `nodes.set` + high-water mark + the `("node", id)` stamp; re-deriving link refs writes at most the node's degree |
| `set_widget` (top-level) | 3.8 / 4 → **2 under §1.2** (widgets.set + stamp) | yes |
| `set_widget` (interior) | whole-blob in prototype → **2 under §5.1** | yes (was the flagged violation; fixed by layout) |
| `connect` (concrete) | 4–5.2 / 7 → **+1 under A19** | yes — bounded by the displaced link's source degree; A19 replaces the claimed identity stamp with its tuple-bearing durable form on materialization |
| `connect` (autogrow) | ~4 → **+2 under A7, +1 under A19** | yes — `grow_id` identity keeps replays non-clobbering; A7 adds the `("grow", …)` stamp and the `("grow_request", …)` row, plus renames bounded by the family's concurrent-grow count; A19 persists the complete link tuple |
| `delete_node` | 4.7–5 / 6 → **+1 under A7, +1 per named link under A19** | yes — writes bounded by the node's degree and `removed_links`, plus the `("node", id)` stamp; the dangling-reference *scan* is O(nodes) read cost, accepted |
| `clear` | O(doc), **+1 stamp per `removed_nodes` entry under A7** | **no — inherent.** Rare; standalone-only at the *authoring* surface (vocabulary §1.5: `apply_specs` rejects a spec batch containing it, code `workflow_clear_not_batchable`) — the *replay* surface (`apply_op` / `applyOps`, §4 abort-remainder) accepts it in any position and must, per `docs/portability.md`. SHOULD be host-mediated and never merged casually |

---

## Amendments

Post-v1 changes append `## Amendment v1.x — <date>` sections here; silent
edits to decided sections are not valid. The OPEN items eligible for
amendment: shared-definition forking (§5.3), group ops (§6), multi-writer
topology (§2.2), watermark implementation status (§4).

**Allocating a letter:** the number is claimed **when the amendment lands on
`main`**, not when the branch is written — take the next one after the last
amendment on `main`. Three in-flight branches each grabbed "the next number"
independently once, and two of them collided. If your branch is not the one
merging, renumber on rebase; an amendment letter is a citation, and the cost of
moving one is why it is assigned at the point it becomes real.

---

## Amendment A1 — 2026-08-12 — concrete-input contention; id-type identity

Tracks comfy-cli `docs/op-vocabulary-v1.md` **amendment v1.2**, cited by SHA:
`1201b676275ce7e9b5cdb90f135b6e115ba9df10`. Read §11.1/§11.2 there for the
normative rule, the rejected alternatives, and the batch caveat; this document
and that one must move together. The branch that carried the amendment
(`kishore/v1-032-connect-lww`) no longer exists, which is why the SHA is the
citation and the branch name is not — the commit still resolves, and its
`docs/op-vocabulary-v1.md` is byte-identical to the rebased
`a534630fda3b11acb49481dbc479aaed46fe2b39`. Note that this SHA is *ahead* of the
base vocabulary pin in "Normative inputs" above: amendment v1.1 (§10) is already
present at it and this package has not adopted it, which is the `reset_doc` drift
tracked as Q5 in `docs/api-contract-proposal.md`. No `SCHEMA_VERSION` bump: the Y.Doc LAYOUT is unchanged —
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
   * The register claim is **unconditional once the gate passes**. A winning
     connect whose source was concurrently deleted therefore leaves the input
     EMPTY: delete wins over the new link, not over the register claim.
     Deferring the retirement until the link is known installable would make
     the incumbent's survival depend on when the delete arrived — the same
     class of bug, one layer down.
     **Amended by A6:** this bullet used to say the claim happens BEFORE the
     source endpoint is resolved. Since issue #10, `from_slot`'s op-only domain
     is checked unconditionally ahead of the claim, and an EXISTING source's
     slot record is resolved ahead of it, so that a rejected op mutates
     nothing. The rationale above is unchanged and is exactly why the split is
     drawn there; see §2.5 items 4-8 and the rule beneath them.
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

---

## Amendment A3 — 2026-08-21 — `migrate()` is the fail-closed read gate; "exact no-op" is byte-level

§10 said `migrate()` is an "exact no-op when `fromVersion === SCHEMA_VERSION`"
and that a doc *newer* than `SCHEMA_VERSION` is rejected. Both were true of the
intent and neither was true of the code (issue #20). The current-version path
"validated" the layout by calling the `nodes`/`links`/`definitions`/`meta` root
helpers, and `Y.Doc#getMap` lazily **creates** an absent root type and
registers it in `doc.share` — so the inspection was a repair. An incomplete
document was silently completed instead of rejected. And because `stored` was
compared only when it was not `undefined`, a document with no readable
`meta.schema_version` was accepted as current: fail-OPEN, against KA-11.

This also hit well-formed replicas, not just malformed docs. `definitions` is
empty at mint, an empty root map is not encoded, so a replica forked from the
one seeded snapshot (§9) does not carry it — and the old read conjured it,
mutating a snapshot-forked replica (KA-10).

### The rule

- `migrate()` is the fail-closed READ gate. Validation runs on **every** path,
  including `fromVersion === SCHEMA_VERSION`.
  **Superseded in part by Amendment A5:** `migrate()` is *a* fail-closed read
  gate and remains the migration path, but it is no longer the only one, and it
  was never the load-bearing one — nothing forces a caller through it.
  `project()` carries the same gate as of #38, and both call one shared read.
- `fromVersion` is a caller *claim*, made by a caller that may not have minted
  the document. It must agree with the document's own `meta.schema_version`.
- A doc with **no readable `meta.schema_version`** — no `meta` root, or a
  `meta` root without the key — is **rejected**, not assumed current. Every
  document a conforming producer emits carries the key: `mint()` writes it
  unconditionally as the first statement of its transaction, `initDoc()` writes
  it when absent, and `meta` is non-empty at mint so it is always encoded into
  the bootstrap snapshot.
- **"Exact no-op" is byte-level**: `encodeStateAsUpdate(doc)` is unchanged
  **and** no root type is materialized. The version check reads `meta` only
  when `doc.share` already holds that root, so it adds no struct and no share
  key. The same holds for a rejection: fail-closed never half-writes.
- Rejections are `SchemaVersionError` (`src/types.ts`). **One exception**: a
  document whose `meta` root was integrated as a different concrete Y type
  surfaces Yjs's own constructor-clash `Error`, not a `SchemaVersionError`. It
  is still fail-closed, and it is still a throw, but a consumer matching on the
  error type must expect it.

### What this deliberately stopped checking

The removed root-helper calls had one incidental side effect worth naming: on a
document whose `nodes`/`links`/`definitions` root was integrated as the **wrong
concrete Y type**, `getMap` threw a constructor clash, so `migrate()` rejected
it. It no longer does — `migrate()` reads only `meta`, so a `nodes` root bound
to a `Y.Array` now passes the version gate.

That is accepted, and stated rather than left to be discovered:

- the mechanism was the defect, not a design. It "validated" by materializing,
  which is precisely what §10 forbids, and it detected nothing about a root's
  *contents* — a `nodes` map full of garbage passed before and passes now;
- no conforming producer can emit such a document. Roots are created only by
  `mint()`/`initDoc()` and by integrating a snapshot minted from them;
- it is not swallowed forever. The clash still throws at the next real read of
  that root — `project()` or `applyOps` — rather than being converted into a
  success.

A structural gate that checks root types **without** materializing them is a
legitimate future addition. It is not this amendment, and it must not be
implemented by calling `getMap`.

### Guarded by

`test/roundtrip.test.ts` (`migrate (schema §10)`) and
`test/schema-version-on-read.test.ts`. The no-materialization property is
asserted on `[...doc.share.keys()]`, not on `encodeStateAsUpdate` — an empty
materialized root encodes to zero bytes, so the byte assertion alone cannot see
it. Both assertions are load-bearing and neither is redundant.

### Consumer impact

`migrate()` has no caller outside this package's tests, in any repo: the cloud
doc-host imports `applyOps`/`mint`/`project` and not `migrate`, and the FE
follower records in source that it must never call it (host-only). The FE
follower's own read gate already rejects a missing `meta.schema_version` for
the same stated reason, so this brings `migrate()` into line with a rule the
sibling reader already enforces rather than introducing a new one.

---

## Amendment A4 — 2026-08-21 — projection skips only what it cannot read; name-keyed widget writes are catalogue-checked at apply

§7 declared its canonicalization list exhaustive ("all of them — the spike
confirmed this list is exhaustive"). It gains a sixth rule, and §1.2 gains a
matching write-side refusal. Both come from issue #13.

### The production failure this fixes

A name-keyed (object, not array) `widgets_values` is not an attacker shape. It
is what 23 shipped workflow templates carry — 49 nodes across `VHS_VideoCombine`
and `VHS_LoadVideo`. Meanwhile the pinned catalogue is enumerated from
`object_info`, which cannot see frontend-injected DOM widgets: `VHS_LoadVideo`
resolves 8 widget names against the template's 9 (`videopreview`),
`VHS_VideoCombine` 6 against 11. And the bulk template writer forwards the
template's node JSON **verbatim**, remapping only ids.

So `add_node` accepted a payload naming widgets the catalogue does not
describe, and `project()` then threw for the WHOLE document on every later
read. One accepted op permanently poisoned the workflow — unreadable, and
unwritable too wherever the write path projects as part of its response.

### The rule

- **Write side (§1.2).** A NAME-KEYED widget write naming a class absent from
  the pinned catalogue, or a name absent from that class's `widget_order`, is
  **rejected before that op mutates anything** — `uncatalogued_widget_write` and
  `unknown_widget`. Per-op, not per-batch: under §4 abort-remainder a batch with
  a valid prefix keeps that prefix, so the DOCUMENT is not byte-identical after
  such a batch, only after a batch whose first op is the rejected one. The
  golden vectors pin both shapes. This binds `add_node`, `set_widget`, and `connect`'s
  `grow.inputcount` bump identically; an asymmetry between them relocates the
  poisoning to the laxest op rather than closing it. A POSITIONAL array for an
  uncatalogued class is NOT this case: it is stored opaquely and round-trips
  verbatim (Amendment A2). With no catalogue at all, the check is skipped —
  "no catalogue" is not "class unknown".
- **Read side (§7 rule 6).** One entry of the nodes map is SKIPPED when
  projecting it would throw: it is not a `Y.Map`, or its `widgets` slot is not
  a `Y.Map`. Neither is reachable through `mint`/`applyOps`, so such an entry
  arrived as corrupt or untrusted doc state. Every other shape a node can carry
  projects verbatim under §1.1 passthrough, **including** a mistyped
  `flags`/`inputs`/`outputs`, a blank or absent `type`, and an `id` that
  disagrees with its map key.
- **Catalogue-contract violations are not skipped** and still throw (§3 pin 4,
  KA-12). Projecting under a catalogue other than the one the document pins is
  drift, and hiding it would let replicas project silently different workflows.

### Why the read gate is exactly two conditions wide

A draft of this amendment skipped more: mistyped slots, a blank `type`, an
id/key disagreement. Every one of those is reachable through this package's own
writers — `createNodeMap` stores a non-plain-object `flags` as a plain clone per
§1.1, and `applyAddNode` keys by `op.node_id` without requiring `op.node.id` to
agree. The result was that `applyOps` returned `failed: null` and `project()`
silently deleted the node, which also burned the node id, since `add_node`'s
structural-idempotency early return then made the honest retry a no-op.

**A read-side gate must never be wider than the throw it prevents.** Anything
else is the read path overruling the write path, and it presents as data loss
with a success return.

### What a skip costs, and why it is still right

Skipping is a fail-OPEN on the read path, chosen because the alternative is that
one corrupt entry makes the whole document permanently unprojectable — the
crash #13 reports. Its price must be stated plainly: **a skipped entry does not
survive compaction.** §4 re-mints from `project(doc)`, so the next compaction
writes a document in which the entry does not exist, and recovering it needs the
pre-compaction update history. Links project independently, so a skipped node
can also leave a link tuple naming an id absent from `nodes`. **Widening this
gate is therefore a data-deletion change and requires its own amendment.**

This is deliberately the opposite disposition from A3, and the two do not
conflict. A structurally unreadable single entry is one bad entry in a document
the reader otherwise understands completely, so per-entry recovery exists. A
wrong `schema_version` means the reader cannot interpret the layout at all, so
there is no readable remainder to salvage and a skip is not even available.
Salvageability is the axis, not severity.

### Guarded by

`test/project.test.ts` (`project invalid node input`, `set_widget applies the
same catalog rules as add_node`), `test/fuzz-untrusted-input.test.ts` (the `#13`
corpus baselines, which assert rejection BEFORE mutation), and
`fixtures/golden-vectors/rejection-retry.json`
(`uncatalogued-named-widget-write-*`, including the abort-remainder case with a
valid prefix, so a cross-language runner learns the new `code`).

### Consumer impact

The doc-host sidecar's `/apply` and `/project` both reach this code, and its
`/apply` response embeds a projection — which is why an unprojectable document
was bricked for reads and writes alike. Both shipped consumers pin an immutable
SHA predating this change, so it lands with a deliberate pin bump.

One behaviour change is user-visible and is not a bug: fetching one of those 23
templates now fails part-way through the batch with `unknown_widget` (ops after
the failing index are not applied, §4 abort-remainder) instead of appearing to
succeed and leaving an unreadable document. The underlying gap — the catalogue
cannot describe frontend-injected widgets — is not fixed here and is the reason
the failure is loud rather than absent.

---

## Amendment A5 — 2026-08-21 — the schema-version gate moves onto the READ path; one shared definition

A3 made `migrate()` fail closed and called it "the fail-closed READ gate". That was true of
`migrate()` and false of the system, because **nothing forces a caller through `migrate()`**. The
function every consumer actually calls is `project()`, and it had no version check at all: a
document minted by a NEWER package was best-effort projected by an OLDER reader as though it were
current. That is precisely the silent mis-projection KA-11 exists to prevent, and it was recorded as
a known gap in a test file rather than fixed (issue #38).

A3 is not wrong; it is incomplete. This amendment supersedes A3's first rule bullet only.

### The rule

- **`project(doc, catalog)` refuses, before it reads any workflow content**, a document whose
  `meta.schema_version` is absent, is not a positive integer, or is not this package's
  `SCHEMA_VERSION`. Reading the version claim is itself a key read; "before any content" is the
  precise statement.
- **"Unreadable" is one definition, in one place.** `readSchemaVersion` (`src/schema-version.ts`) is
  the only implementation of "what version does this document claim, and may this package read it".
  `migrate()` calls it too — it holds no private copy. A3's own text defined unreadable as "no `meta`
  root, or a `meta` root without the key"; this narrows it by one case, and the narrowing applies to
  BOTH entrypoints: a `schema_version` that is present but is not a positive integer (`"1"`, `null`,
  `1.5`, `0`, `-1`) is unreadable, because a value that is not a version cannot be compared to one.
  The set of documents `migrate()` rejects is unchanged — such a value could never equal an integer
  `fromVersion` — only its diagnosis moves, to the accurate one.
- **An OLDER document is refused, not migrated in place.** `project()` is a read ANY replica may
  call, browser follower included; migrating inside it would make a read WRITE the shared
  document. (Stated as a rule about the API, not an observation about callers: no follower calls it
  today — the frontend does not depend on this package at all, exactly as ADR-004 records.
  `follower-boundary.md` requires treating such an API as a blocking violation "even if current
  callers behave correctly".) That breaks KA-6/FC-5 outright (followers never write the shared doc), and a follower
  that self-migrated becomes an independently edited replica, which is the FC-1 raw-struct
  divergence path. The transition stays where it can be audited: the host runs
  `migrate(doc, storedVersion)`, then reads. Projecting the old layout as-is is not an option
  either — that IS the mis-projection KA-11 names.
- **The refusal is byte-exact AND materializes no root**, matching A3. Both halves are load-bearing
  and neither is redundant: an empty materialized root encodes to zero bytes, so the
  `encodeStateAsUpdate` assertion alone cannot see a materializing gate. `[...doc.share.keys()]` is
  the observable of record.
- **A3's error-type carve-out carries over unchanged.** A document whose `meta` root was integrated
  as a different concrete Y type surfaces Yjs's own constructor-clash `Error`, not a
  `SchemaVersionError`. Still fail-closed, still a throw, but a consumer matching on the error TYPE
  must expect it on this path too.
- **Ordering.** The schema gate runs before the §3 pin 4 catalogue check and before §7 rule 6's
  per-entry skip. A document at an unreadable schema reports THAT, not a catalogue error from a
  projection that should never have started.

### What this does NOT change, stated rather than left to be discovered

- **No op semantics.** No op kind, field, rejection code, stamp rule or wire shape is touched.
- **The per-entry skip (§7 rule 6, A4) is untouched and is deliberately the opposite disposition.**
  Salvageability is the axis, not severity: an unreadable single entry leaves a document the reader
  otherwise understands completely, so per-entry recovery exists; a wrong schema version means there
  is no readable remainder at all.
- **`project()`'s ACCEPT path still materializes the `nodes`/`links`/`definitions` roots**, because
  it types them unconditionally. On a snapshot-forked replica (§9) that legitimately lacks
  `definitions`, a successful projection therefore grows `doc.share`. This is the #20 defect one
  function over; it is **unchanged from before this amendment** and is not closed here. Nothing is
  encoded, so nothing goes on the wire. It is named because this amendment writes "`project()` is a
  pure read" into the record, and that sentence is true of the document's CONTENT and of the wire,
  not of `doc.share` on the accept path. A structural fix belongs to its own change, and — as A3
  already says — it must not be implemented by calling `getMap`.

### Guarded by

`test/schema-version-on-read.test.ts` (both entrypoints, every case, including the
registered-but-empty `meta` root, the wrong-Y-type carve-out, and the refuse-vs-accept
materialization contrast on a snapshot-forked replica) and `test/roundtrip.test.ts` (the `migrate()`
path). Every fail-closed case runs against a real fixture workflow that projects cleanly one line
earlier, so a `toThrow()` cannot pass for a reason unrelated to the schema version.

The "document is OLDER than the reader" arm has no production reachability at `SCHEMA_VERSION = 1`
— no older version exists to construct. It is exercised through
`assertSchemaVersionAgainst(doc, context, expected)`, exported from the module but deliberately NOT
from the entrypoint, since a caller free to choose `expected` could pass the document's own version
and switch the gate off. An arm no test can turn red is dead code; this one can be turned red.

### Consumer impact

**Nothing this change refuses is a document a conforming producer can emit.** Established from the
consumer repositories at their current revisions, not by analogy to A3:

- **Every document in the CRDT path originates from `mint()`.** All four `docstore.Init` call sites
  in `Comfy-Org/cloud` are `Mint → base64-decode → Init`
  (`services/agent/internal/loop/crdt.go` `reseedDoc` and its two siblings, and
  `shadowdiff/remint.go`), and `mint()` writes `schema_version` unconditionally as the first
  statement of its transaction. `Advance` only ever stores `/apply`'s fold of such a document.
- **Workflow JSON cannot clobber the key.** `mint()` throws on any workflow key colliding with a
  reserved doc-meta key, so `schema_version: "banana"` in a workflow is rejected at mint, on both
  builds.
- **No op can write or delete it.** The applier touches `meta` only for `last_node_id` and for
  `clear`'s `groups`, and `clear` preserves everything else.
- **The op producer never constructs a document at all.** `comfy-cli` emits ops as plain JSON; it has
  no Yjs dependency, no `Y.Doc`, no snapshot handling.
- **At the time of this amendment, the frontend did not consume this package.** It now consumes the
  canonical workspace source from `packages/comfy-multi-player`; this historical compatibility
  argument applied before that migration, not to future package changes.
- **Two endpoints reach `project()`**, both in the doc-host sidecar: `/project` and `/apply` (whose
  response embeds a projection computed after `applyOps`). `/mint` and `/resync` do not.

**Where the behaviour genuinely changes, it changes for the better.** A doc-host request carrying a
snapshot that folds to a root-less document previously returned HTTP 200 with `{"nodes":[],"links":[]}`;
it now returns HTTP 400. On the `/apply` path that converts "commit a prefix of ops onto a document
we cannot read, and report `ok`" into "commit nothing, fail the turn" — the sidecar's own catch
already anticipates this case in a comment, and it raises `apply_error` 400, not a 500, so the Go
turn loop never reaches `Advance`.

**On the partial-apply hazard: unchanged for conforming documents.** #31's in-band rejection made
`/apply` returns 200 with ordered per-op outcomes, and the Go side commits the prefix whenever an outcome is `applied`, `no-op`, or `lww-dropped`
regardless of `failed`. This change neither fixes nor worsens that. It only removes the *schema-less*
variant of it. **The `CLOUD-PARTIAL-APPLY-OK` precondition on the pin bump still stands in full.**

**The pin bump is where this becomes live, and it carries both.** The sidecar's lockfile pins
`@comfyorg/comfy-multi-player` at a commit thirty behind this one, so neither A4 nor this amendment
is in production; a bump lands them together. Two things to do first: fix the partial-apply
commit-the-prefix behaviour, and add a cloud-side test for a schema-refused document — every existing
doc-host test builds its snapshot from `/mint`, so the new 400 path would ship untested there.

**One forward hazard, recorded because it is invisible until it lands.** `reset_doc`'s reference
semantics in `comfy-cli` clear the workflow down to its `id`, which would wipe `meta.schema_version`
— and under this amendment no op could restore it, so the document would be permanently unreadable.
It is not reachable today: `reset_doc` is deferred and rejected `op_deferred`, verified by probe on
both builds. **This must be resolved before `reset_doc` is un-deferred.**

---

## Amendment A6 — 2026-08-21 — `from_slot` validation splits; the convergence carve-out RULE

**Status:** landed with the issue-#10 validate-before-mutate fix (PR #34).
**Touches:** §2.5 (carve-out list, new items 4-8, plus the generating rule that replaces its completeness claim), Amendment A1 bullet 3,
Amendment A4's "before that op mutates anything" claim,
`docs/api-contract-proposal.md` D3, D4 and D5, `docs/INVARIANTS.md` KA-4,
`docs/ROADMAP.md`'s #10 bullet, and `README.md` (outcome table, delete-wins
bullet, Known carve-outs).

**Letter note:** drafted as A5 and renumbered to A6 on rebase when PR #60 landed
A5 first — the allocation rule's "if your branch is not the one merging,
renumber on rebase", executed rather than cited.

### What changed

`connect.from_slot` validation is now two checks, and the split is the reason
the applier converges at all:

1. **Op-only** — gathered into one function that reads nothing but the op, so
   every replica reaches the same verdict in every document state. Runs
   UNCONDITIONALLY, before the concrete-input register claim, before the source
   is looked up, and before the `!dst` delete-wins return. It covers
   `Number.isInteger(from_slot) && from_slot >= 0` (`output_slot_missing`); the
   same domain on `to_slot` when there is no `grow`, i.e.
   `Number.isInteger(to_slot) && to_slot >= 0` (`input_slot_missing`); a numeric
   `to_slot` at all, a string `grow.inputcount.widget`, a structured-cloneable
   `grow.inputcount.value`, and string `grow.name`/`grow.type` (all
   `malformed_op`); and the evaluation of `stampKey`, which is op-only and used
   to sit below the delete-wins return in the concrete branch.
2. **State-dependent** — in range for the source's `outputs`, and addressing a
   real slot record. Reachable only while the source node exists, because
   neither fact is knowable once it is gone. Same code.

### Why the split is load-bearing, not stylistic

Issue #10's fix moved `from_slot` resolution ahead of the first mutation so a
rejected op leaves the document byte-identical. Done naively — with the WHOLE
check behind `if (src)` — that makes rejection depend on document state, which
is strictly worse than the bug it fixes:

| arrival order | `connect` with `from_slot: -1` racing `delete_node(from_node)` |
| --- | --- |
| connect, then delete | rejected; incumbent link on the target input SURVIVES |
| delete, then connect | source already gone, malformation invisible; op ACCEPTED, register claimed, **incumbent link retired** |

Same op-set, two legal orders, two different documents — §2.5's convergence
requirement, violated by the fix rather than by the bug. It was measured, on
`-1`, `0.5` and `NaN`, with the valid-`from_slot` control converging in the same
run. Hoisting the op-only half above every document read closes it: a malformed
op is now refused by every replica regardless of what else it has applied.

### The residual, stated rather than implied

The state-dependent half cannot be made order-independent **without changing
the register's semantics or adding tombstones**. "Is `from_slot: 5`
in range" is unanswerable once the source node is deleted, so a `connect` naming
an out-of-range slot is rejected by a replica that still has the source and
accepted as a register-claiming no-op by one that does not. This is **§2.5
item 4**, and it is narrower than the three already listed: it
applies only to a `from_slot` that is a non-negative integer AND out of range
for its source AND racing that source's deletion.

Three ways to close it were considered and all are worse than the carve-out:

1. **Defer the source check back below the register claim.** Re-opens issue
   #10 — the mutate-then-throw this amendment exists to fix.
2. **Record each node's output arity in a tombstone that outlives deletion.**
   §5 has no tombstones, and nothing else needs them.
3. **Make the register claim conditional on the source resolving.** This does
   NOT converge either — it moves the divergence rather than removing it.
   Measured, with the incumbent link sourced from a node that is not deleted:
   connect-then-delete claims the register, retires the incumbent, installs
   the new link, and the delete then retires that link too, leaving the input
   EMPTY; delete-then-connect becomes a total no-op, leaving the input still
   holding the INCUMBENT. It also changes the outcome for a **valid** op — A1
   bullet 3 and contract D5 both specify the input is left EMPTY — so it would
   additionally be a vocabulary change to the concrete-input register needing a
   comfy-cli counterpart. Rejected on both counts.

The carve-out is the deliberate choice; `test/reject-no-mutation.regression.test.ts`
pins the op-only vectors that DO converge, on both the source and the
destination axis, and deliberately omits `from_slot: 5` so the omission is
legible rather than an oversight.

### The destination axis — §2.5 item 5, the same shape one node over

The identical argument applies to `to_node`. `if (!dst) return` is a delete-wins
no-op that CONSUMES the `op_id`, so any precondition evaluated below it makes a
malformed op "applied" on a replica that has seen the delete and "rejected" on
one that has not — and under §4 abort-remainder the rejection also discards the
rest of the batch on one side only, turning a bookkeeping disagreement into a
projection divergence. Measured: `[connect(malformed), add_node 900]` racing
`delete_node(to_node)` yields `nodes={300,301}` in one order and
`nodes={300,301,900}` in the other.

So every op-only `connect` precondition is hoisted above that return too, and
the residual is exactly the checks that must READ the destination: `to_slot` in
range or addressing a slot record, an opaque widget destination, and a
`grow.inputcount.widget` the catalogue cannot describe. None is answerable once
the destination is gone, and the three alternatives above are rejected here for
the same reasons.

**Scope, stated precisely.** Items 4 and 5 are about `connect`. The identical
shape in `applySetWidget` and `applyAddNode` is items **6 and 7** — enumerated
rather than merely mentioned in passing, because §2.5's closing sentence claims
completeness and "adjacent to carve-out 3" is not "listed in §2.5". All four are
about WHERE an existing check runs rather than which properties are checked.

None of items 4-7 is CLOSED here. Hoisting those checks would newly reject
payloads `main` accepts — a `set_widget` naming a deleted node, a duplicate
`add_node` with a bad payload — on handlers this amendment does not otherwise
touch, so each needs its own vocabulary analysis. They are enumerated and
pinned instead, on the principle that a convergence list claiming completeness
must either list a divergence or stop claiming completeness. `connect.link_type`
is copied into the document with no validation. `connect.link_id`, by contrast,
has been checked since A9 (#59), and A10 (#68) now applies the write site's
encodability predicates (`arrayItemRefusal`/`mapValueRefusal`). That check is
still below the destination delete-wins return: a batch containing a `Date`
`link_id` reports `malformed_op` before the delete but is consumed as a no-op
after the delete. It is named here so that "every op-only precondition is
hoisted" is not read as "every op-only property is validated before a
document-dependent return".

**This axis had to be found twice, both times the same way.** The first pass
hoisted `from_slot` only; the second hoisted `to_slot`'s `typeof` check but left
its integer/sign domain below the return — and both times the full suite stayed
green while prose claimed the whole class was hoisted. The divergence was found
by probing both arrival orders directly, not by reading. If a future change adds
a `connect` precondition, the question is not "is it validated before the first
write" but **"does it read the document"** — and if it does not, it belongs in
`requireOpOnlyValid`.

### Consequent corrections

- **Amendment A4 (#31) claimed more than it shipped, and this amendment repairs
  it rather than quietly benefiting from it.** A4 states that a name-keyed
  widget write to an uncatalogued class is "rejected before that op mutates
  anything" and that this "binds `add_node`, `set_widget`, and `connect`'s
  `grow.inputcount` bump identically." That was false for the `connect` arm as
  shipped: measured on `main`, an uncatalogued `grow.inputcount.widget` returned
  `unknown_widget` with the grown slot already appended and the bytes changed.
  Hoisting `validateWidgetName` above the slot append makes A4's sentence true.
  One consequent behaviour delta, recorded because it is not obviously implied:
  the check now also runs above `applyInputcountBump`'s LWW gate, so an
  LWW-dropped bump naming an uncatalogued widget is REJECTED where it used to be
  silently dropped. The catalogue is pinned at mint (KA-12), so both replicas
  read the same catalogue and this does not diverge.

- **A1 bullet 3** said the register claim "happens BEFORE the source endpoint is
  resolved". That is no longer true for a source that EXISTS: the op-only domain
  and the source's slot record are both resolved first. The property A1 was
  protecting — *the incumbent's survival must not depend on when a delete
  arrived* — is preserved for the op-only domain and explicitly carved out for
  the in-range half. The bullet is amended, not deleted, because its rationale
  is still the reason the split is drawn where it is.
- **`api-contract-proposal.md` D5** carried the same sentence and is corrected
  alongside it.
- §2.5's closing sentence no longer enumerates completeness at all. It now
  states the RULE that generates the carve-outs — a check that reads the document
  and sits below an `op_id`-consuming early return — and marks items 1-8 as
  illustrative of it. That change is the durable one: this list was extended
  three times in a single review, and each omission read as a contradiction only
  because the sentence claimed the list was exhaustive.
---

## Amendment A7 — 2026-08-21 — stamp-gated node presence, canonical autogrow naming, scoped `clear` (issue #11)

**Ratification still owed.** This amendment closes §2.5 carve-outs 2 and 3.
Carve-out 3 is item 3 of `docs/api-contract-proposal.md` Q6, which asks
maintainers to "confirm we are all fine with them, or say which one is not
acceptable". That confirmation has NOT happened. Do not merge the
implementation until it does.

**Cross-language counterpart still owed.** `README.md` makes comfy-cli
`docs/op-vocabulary-v1.md` normative for op semantics and calls a divergence
"a bug here"; Amendment A1 cites its counterpart by SHA. This amendment has
**no** comfy-cli counterpart yet, and the `clear` rule below genuinely
diverges from the vocabulary's "`clear` empties nodes and links". A matching
comfy-cli amendment must land and be SHA-cited here before merge (FC-10,
KA-1). Until then this section is a proposal, not a pin.

No `SCHEMA_VERSION` bump. The Y.Doc layout is unchanged: A7 adds `__stamps`
rows (a ledger §7 already excludes from projection) and changes which targets
the gate consults. Forward-compat holds — a new reader reads an old document
and simply finds no `("node", id)` rows, which it treats as "unstamped", the
same as a freshly minted node. Backward-compat holds for projection and
degrades only for conflict resolution: an older reader ignores the new rows
and falls back to arrival order, which is the behavior it had anyway.

### The rules

1. **Node presence is LWW-gated** on `("node", String(node_id))` for
   `add_node`, `delete_node`, and each id in `clear.removed_nodes`. The
   winning op's payload is authoritative (§3 rule 3); a losing op is an
   accepted no-op that still consumes its `op_id`. This closes §2.5 carve-out
   3 (`add_node` first-writer-wins by arrival).

2. **`add_node` re-derives only `inputs[].link` and `outputs[].links`** from
   the live `links` map. Everything else in the payload is copied verbatim
   (FC-8). Link topology belongs to `connect`/`delete_node`, and a payload
   carries mint-time link state: applied verbatim over a live node it could
   disown a link the document still holds — leaving the source port empty
   while the destination still consumed it — or resurrect a severed one, with
   the outcome depending on whether the concurrent delete had arrived.

3. **`delete_node` writes two independent registers.** Node presence is gated
   as in rule 1. Severance of the link ids the op names in `removed_links` is
   **ungated**: removing a named link is monotonic (link ids are never
   reissued), concerns other nodes' slots, and commutes with a re-add. Gating
   it made `[delete, add]` settle with `links: []` and `[add, delete]` settle
   with the link still installed. Links merely INCIDENT to the node — not
   named by the op — are severed only when the node itself is removed.

4. **Autogrow stays ungated but is canonicalized.** §2.5 carve-out 2 said
   concurrent grows assign display names by arrival. They now assign them by
   stamp: the grown slots of one family are ordered by their ops' stamps, and
   names and link tuple indexes are assigned from that order. Neither grow is
   dropped, so the reason carve-out 2 existed (gating would discard one of two
   deliberately non-clobbering grows) is respected. Each grow's own requested
   name and shape are recorded next to its stamp under
   `("grow_request", to_node, grow_id, family)`, because the canonical
   assignment must replay every racing grow's own request — deriving them all
   from whichever op happens to be executing made two grows that asked for
   different names in one family settle differently per arrival order.

5. **`clear.removed_nodes` is the authoritative target set.** It records the
   node ids present at mint time. An applier MUST NOT re-derive the set from
   its own live `nodes` map when the list is empty: that reads
   arrival-dependent state, and a `clear([])` that outranked a concurrent
   `add_node` removed the add when the add arrived first and spared it when
   the add arrived second. Links are removed **iff an endpoint is no longer
   present** — the same rule `delete_node` uses — rather than wiped wholesale;
   when `removed_nodes` covers the whole graph that is identical to emptying
   `links`. A `clear` whose `removed_nodes` is empty therefore removes
   nothing. **This is the divergence from comfy-cli named above.**

### What is NOT closed

§2.5 carve-out 1 (`outputs[].links` ordering) is untouched. So is the
pre-existing gap where a malformed op is validated only if it is not
short-circuited first, which makes rejection itself arrival-order-dependent;
that belongs to the envelope-validation order, not to this amendment.

### Cost

§11's counts move: `add_node` and `delete_node` each gain one `__stamps`
write, `add_node` additionally writes at most its own degree when re-deriving
link references, and `clear` gains one `__stamps` write **per removed node**
on top of its already-O(doc) cost. `__stamps` rows for deleted node ids are
never reclaimed; §4's compaction carries forward "entries for still-live
targets", so a compaction implementation must decide explicitly whether a
`("node", id)` row for an absent node is still live — dropping it would let a
post-compaction re-add of that id win by default.
---

## Amendment A8 — 2026-08-21 — `op_id` reuse is a protocol violation, and `__applied` records a payload digest (issue #12)

The rule and its rationale are in §4 above, which this amendment rewrites in
place. Recorded here for the amendment log:

- **Ratified, not new policy.** `decisions/ADR-007-op-based-crdt-v1.md:68-70`
  and `.agents/checks/op-identity.md` already required rejection of an `op_id`
  reused with a differing payload. The applier accepted it silently, and
  `test/fuzz-untrusted-input.test.ts` had pinned the accepting behavior; that
  assertion is inverted by this change, which is the point.
- **No `SCHEMA_VERSION` bump**, with the reasoning stated in §4: the layout is
  unchanged, `__applied` is `__`-prefixed and excluded from projection, and a
  pre-A8 `1` value is explicitly still accepted.
- **New rejection code:** `op_id_reuse`. Plus `payload_too_deep` from the
  canonicalizer's depth bound.
- **Cross-language counterpart owed.** comfy-cli must adopt the same canonical
  form and digest, or a document written by one and retried against the other
  rejects a legitimate replay. `README.md` makes the vocabulary normative and
  Amendment A1 cites its counterpart by SHA; this one has no counterpart yet
  (KA-1, FC-10). The applier degrades safely in the meantime — a pre-A8 `1` is
  always accepted — but two A8-aware implementations that disagree on
  canonicalization do NOT degrade safely.

---

## Amendment A9 — 2026-08-21 — Yjs storability is an op precondition (issue #10)

`structuredClone` is necessary but insufficient before a write: Yjs accepts
different value domains for a `Y.Map` value and a `Y.Array` item. Values that
clone but are outside the destination domain are now rejected before mutation.
`connect.link_id`, which is written in both forms, must satisfy their
intersection. `delete_node.removed_links` is likewise checked for iterability
before the A7 node-presence stamp gate and deletion. These checks preserve the
A6 rule: every op-only precondition runs before document-dependent early
returns. They do not change §2.5's remaining convergence carve-outs.

The digest canonicalizer bounds the depth and shape of the whole op envelope
before the idempotency gate; these predicates separately govern which values
may enter Yjs maps and arrays after that gate. They are pinned against real Yjs
writes, and rejected ops are tested for byte identity, unconsumed `op_id`, and
retry safety. Reference cycles are closed by Amendment A10; unvalidated
`connect.link_type` remains outside this amendment. No schema-version bump: the document layout and accepted JSON
wire vocabulary are unchanged.

---

## Amendment A10 — 2026-08-21 — cycle-safe, encodable writes (issue #14)

The write-site predicate now asks whether a value survives Yjs encoding, not
only whether Yjs accepts it. Reference cycles are refused at every write site;
for `applyOps`, A8's whole-op canonicalization encounters the cycle first and
returns `payload_too_deep`, while the same write-site guard independently
protects `mint()`. Top-level `Date` values are refused at the write gate, and
`mint()` refuses `BigInt` values outside signed int64 because they decode as a
different value; A8's JSON canonicalizer already rejects every BigInt op as
`apply_failed` before the write gate. Validation remains
shallow apart from cycle detection; deeper encoding-loss policy remains D4.

---

## Amendment A11 — 2026-08-21 — bounded op breadth, size, and batch cost (issue #14)

A8's whole-envelope canonicalization gate now also rejects an op before the
idempotency check when any array or object exceeds 4,096 entries, or when an
approximate processing budget exceeds 262,144 units. The budget counts string
and key characters, binary bytes, containers, leaves, and every visit; it is
iterative and cycle-tolerant so the budget check itself is bounded. A8 remains
authoritative for depth and cycles and retains `payload_too_deep` for both.

`applyOps` also rejects a batch above 1,024 ops before processing its first op.
Breadth, size, and batch refusals use `malformed_op`; no new rejection code is
introduced. These are processing limits, not Y.Doc layout changes, so no
`SCHEMA_VERSION` bump is required.

---

## Amendment A12 — 2026-08-21 — a third read path, with a CONDITIONAL fail-closed gate (issue #38, PR #55/#76)

**Touches:** §10 (the read-path gate bullet), Amendment A5's "the gate moves
onto the READ path" framing, Amendment A4's read-side-gate rule, and §1 (the
root-map names, as a constraint on how the gate may be implemented).

A5 moved the schema-version gate onto the read path because `migrate()` was a
gate a low-context caller could skip. PR #55 then added a second reader —
`src/read.ts`, the read-only snapshot surface — which reads the SAME layout by
the SAME key names and had no gate at all. That re-opened exactly the hole A5
closed, one function call to the left: a caller could route around
`project()`'s refusal by calling `readGraph()` instead, and get v1 key names
over a v2 document.

**The rule.** Every accessor on the snapshot surface refuses a document that
**carries content** under a schema this package cannot read — same
`SchemaVersionError`, same predicate (`readSchemaVersion`), byte-exact,
materializing no root — and **returns its empty value** for a document that
carries **nothing**.

**Why the condition, since a conditional gate deserves a reason.** ADR-004's
frontend follower reads a document that has no roots at all between
construction and its first `doc_update` frame. There is no content there to
mis-key, and KA-11 is a rule about MIS-PROJECTING an incompatible document,
not about refusing an empty one. (`migrate()` does refuse that document — A3 —
and that is a role split, not a precedent: migrating a document that makes no
claim about its own version is an incoherent WRITE request. Reading nothing
out of it is not.)

**ONE DISPOSITION DIVERGENCE FROM `project()`, stated here because A5's
consumer-impact note recorded the opposite disposition as a defect.** A5
records that a doc-host request whose snapshot folds to a **root-less
document** changed from HTTP 200 with an empty graph to HTTP 400. The snapshot
surface returns the empty graph for that same document. The two share a
PREDICATE and differ in DISPOSITION, in exactly one document class — the one
that carries nothing. A projection promises a workflow; a snapshot read
promises whatever is there.

**A CONSTRAINT ON THE IMPLEMENTATION, and this is the part a second
implementation must copy.** "Does this document carry content" MUST NOT be
asked by enumerating the §1 root-map names. Those names are v1's, and §10 plus
KA-11 make a rename of them the canonical reason to bump `SCHEMA_VERSION` —
so a name-keyed probe is blind to precisely the document the gate exists to
refuse. Measured: a v2 document that renamed its roots carries real structs
and `project()` refuses it, while a name-keyed probe called it empty and
returned `{"nodes":{},"links":{}}`. On a follower that diffs successive
snapshots, an empty graph is not "nothing to draw" — it is "delete every
node". This implementation asks the struct store (`doc.store.clients`), which
is vocabulary-free. A conforming implementation may ask differently, but it
must be able to see content stored under names this version does not know.

Corollaries of asking it that way, all deliberate:

- a root REGISTERED but never written contributes no struct, so an unrelated
  `getMap` elsewhere in the process cannot flip a document from "readable and
  empty" to "refused". The frontend's own schema guard does exactly that on
  every frame;
- a document whose entries were all DELETED still carries structs, so it
  refuses rather than reading as empty — the fail-closed direction, matching
  `project()`;
- structs buffered pending their dependencies are NOT counted: they are not
  part of the document, `encodeStateAsUpdate` does not emit them, and no
  reader can see them.

**One reachable state hits the refusing clause, and refusing is intended.**
The doc host is stateless, so its deltas carry a fresh clientID per request,
and the relay joins a new subscriber to the fanout before sending it the
catch-up. A follower can therefore integrate a delta before it has any `meta`:
roots with content, no schema claim, refused. The frontend already refuses
that state more strictly today. The empty-document clause covers "no frame has
arrived yet", not "a frame arrived out of order".

No `SCHEMA_VERSION` bump: no Y.Doc layout changes, and no currently-valid
document becomes unreadable that `project()` did not already refuse.

---

## Amendment A15 — 2026-08-27 — promoted subgraph widgets are written on the HOST; `connect` materializes a declared input

Tracks comfy-cli PR #815 (`fix(subgraph): edit promoted widgets where the
frontend reads them`), cited by SHA `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`
and registered in `docs/upstream-pins.json` as
`comfy-cli/workflow_ops@promoted-host-writes`. No `SCHEMA_VERSION` bump — see
the end of this amendment.

**The production defect this closes.** ComfyUI_frontend ADR 0009 keeps a
promoted subgraph widget's value on the HOST instance — `widgets_values[i]` on
the instance node, positional over the definition's inputs that resolve to an
interior widget (socket-only inputs own no slot) — and runs that value over
the interior default. Until now the only subgraph-scoped write this package
applied was the interior `path` form (§5.2), which lands on the interior
default the frontend neither runs nor displays: an agent's `set-widget
57.width 768` was "applied" and changed nothing the user could see. comfy-cli
now mints the host write; the doc host must apply it, and it could not: a
subgraph instance's `type` is a definition UUID, never in the catalog, so the
instance's `widgets_values` is stored opaquely (A2) and `validateWidgetName`
refused the named form with `uncatalogued_widget_write`.

### The two op shapes (comfy-cli's, field for field)

1. **Host write** — a `set_widget` with NO `path`/`inner_widget` and a
   `promoted` payload:

   ```jsonc
   {"op":"set_widget", "node_id":57, "widget":"width", "value":768, "old":1024,
    "promoted":{"value_index":1, "instance_path":["57"],
                "host_widgets_values":["<prompt>",768,1024,0,8,"unet…","clip…","vae…"]},
    "redirected_from":"57/13.width"}   // optional, informational
   ```

   `value_index` is the position in the instance's positional array;
   `host_widgets_values` is the FULL array after the write as comfy-cli
   materialized it (missing entries seeded from the interior defaults, so the
   array stays aligned with the definition's inputs); `instance_path` has one
   segment for a top-level instance and more when the host is itself interior
   to another definition, in which case comfy-cli mints `node_id` as the
   joined path (`"57/61"`).

2. **Promoted connect** — a `connect` whose `grow` carries `promoted: true`:

   ```jsonc
   {"op":"connect", "link_id":…, "from_node":…, "from_slot":0, "to_node":57,
    "to_slot":null, "link_type":"INT",
    "grow":{"name":"width","type":"INT","promoted":true,"widget":"width"}}
   ```

   The destination is a subgraph instance and `grow.name` is one of its
   definition's DECLARED inputs; the frontend rebuilds those `inputs[]`
   entries from the definition on load, so the instance may not carry one yet.
   `grow.widget` is present exactly when the declared input backs an interior
   widget; absent for a socket-only input.

### The rules

**Host write.** After the op-only checks (`promotedHostWrite`: `value_index`
a non-negative integer, `host_widgets_values` an array covering it,
`instance_path` a non-empty array when present AND joining with `/` to
`String(node_id)` — the register is named by `node_id`, the mutated node by
`instance_path`, and nothing else ties them, so a disagreement is refused
rather than left to claim two registers for one node; the array storable; a
host write that also carries `path` is `malformed_op`) and the ordinary LWW gate on
`("widget", String(node_id), widget)` — the SAME register a top-level named
write on that node claims, which is what comfy-cli's `_write_target` produces
for these ops — the instance is resolved through `resolveInteriorNode` over
`instance_path`, exactly as an interior `path` is (delete of the head wins as
a no-op; a nested path through a SHARED definition is rejected
`shared_definition_unforked`, the §5.3 rule comfy-cli forks its way past —
already an EXCEPTIONS row). Then `hostWriteStorage` decides:

| Instance storage | Catalogue | Disposition |
|---|---|---|
| opaque (A2) | any, or none | POSITIONAL write |
| named, class DESCRIBED by the catalogue | present | the ordinary named path — defined, never minted by comfy-cli |
| named | absent | `catalog_required` — the same "reject rather than guess" boundary `add_node` draws |
| named, non-empty map, class NOT described | present | `uncatalogued_widget_write` — the document is unprojectable with this catalogue (KA-12 drift); an opaque array laid over the map would heal it silently |
| named, EMPTY map, class not described | present | POSITIONAL write, converting the node to opaque storage (the instance was minted with `widgets_values: []`) |

The positional write is ONE whole-value `set` of the opaque array (plus the
stamp; plus retiring the empty `widgets` map on first conversion, so the node
carries exactly one storage key): copy the stored array; if it is shorter than
`value_index + 1`, extend it from `host_widgets_values` — **entries the
document already holds win**, only the missing tail is seeded; set
`value_index`. Whole-value storage means two concurrent writes to DIFFERENT
indexes each read-modify-write the whole array and commute (pinned in both
orders), and §1.2's element-wise merge corruption cannot arise (A2's
argument). `project()` hands the array back verbatim.

**Promoted connect.** ONE register named by the definition, so — unlike an
autogrow, and exactly like a concrete input (A1) — it is stamp-gated on
`("input", String(to_node), "grow", name)` with the FULL declared name. Not
the autogrow base-name key: a declared subgraph input name may contain a dot
(`images.image0`), and truncating at the first dot made `foo.bar` and
`foo.baz` contend for one slot. comfy-cli spells it the same way since
amendment v1.5 (PR #818, `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`), which
also gates the register and moves `grow_id` to the winner — closing the
deviation recorded below.
Once the gate passes the register is claimed unconditionally, then: reuse the
`inputs[]` entry whose `name` is `grow.name` (or whose `grow_id` is this
`link_id`, on replay) — retiring its prior occupant whole, and moving a
materialized entry's `grow_id` to the winning link so both arrival orders
project one slot — or append `{name, type, link: null, grow_id, widget?}`
VERBATIM: no collision numbering, no family template, no `grow`/`grow_request`
canonicalization entries (A7 ranks only slots that carry them). The slot is
materialized whether or not the SOURCE still exists; the link is installed
only if it does. So `[connect, delete src]` and `[delete src, connect]` both
end with the input present and empty — the autogrow source-delete race (§2.5
item 2) does not recur here. Delete of the DESTINATION is a no-op before any
register is claimed, as for every connect.

Reuse by NAME is the ordinary sequential case, not only the race: at comfy-cli
main a later `connect` to `57.width` is minted as a promoted grow again (the
declared-input check precedes the concrete-slot lookup in
`_resolve_input_target`), so it claims the same full-name register, wins on
stamp, retires the prior link and takes the slot's `grow_id`.
`fixtures/session-promoted-host.session.jsonl` — regenerated at that revision
— carries exactly that sequence; `test/promoted-host-writes.test.ts` pins the
concurrent race in both orders. (At the PR-#815 head the second connect was
minted as a concrete `to_slot: 1`, a different register; a peer minting that
form still applies, through the concrete branch.)

### Deliberately NOT unified: the host register and the interior register

A host write claims `("widget", "57", "width")`; an unpromoted interior write to
the widget BEHIND the promotion claims `("widget", ["57","13"], "width")`.
comfy-cli redirects the interior ADDRESS of a promoted widget to the host at
mint time, so in practice the interior register is reached only for
unpromoted widgets — but a peer that mints the interior form for a promoted
widget (an older comfy-cli, a hand-authored op) writes the definition's
default while the host value stands, and the two do not contend. Unifying
them would require this applier to know, at apply time, which interior widget
a promotion resolves to (comfy-cli `cql.promoted.find_promoted`), i.e. to
re-derive the promotion table from the definition on every write. Recorded,
pinned (`an interior path write … is a different register`), and left for a
vocabulary amendment.

### Deviation from comfy-cli — RESOLVED by comfy-cli amendment v1.5

At PR #815 comfy-cli's `_apply_connect` did not `_lww_gate` a promoted grow
and left `grow_id` on the first arrival; this applier gated and moved
`grow_id` to the winner, and the divergence was logged in
`docs/decisions/EXCEPTIONS.md`. comfy-cli PR #818 (amendment v1.5,
`ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`) now gates the same register under
the same full-name spelling and moves `grow_id` identically, pinned in both
arrival orders; the EXCEPTIONS row is struck.

`legacy_primitive` writes: at PR #815 the `set_widget` addressed at a
frontend-only `PrimitiveNode` carried no positional payload and was rejected
`opaque_widgets` here (the class is opaque). Amendment v1.5 (§14.3) makes it
carry `promoted.value_index` + `host_widgets_values` with a one-segment
`instance_path`, i.e. exactly a host write; the `legacy_primitive` flag itself
is informational and unread.

**OPEN — `promoted.repair` (vocabulary §14.4, merged to main after this
amendment was drafted).** When the host instance carries a legacy
`properties.proxyWidgets` entry the definition does not back with a linked
input, comfy-cli first repairs it the way the frontend's forward migration
does (`promoted.flush_proxy_migration`) and the host write additionally
carries `promoted.repair = {entry, ids}`; its apply then MUTATES THE
DEFINITION (mints a subgraph input and boundary links, ids derived by
SHA-256 so replay is byte-identical). This applier reads only
`value_index`/`instance_path`/`host_widgets_values`, ignores `repair`, and
writes the host value only — the definition is left unrepaired and the two
implementations then project different definitions for such a document. No
shipped template in the corpus carries a legacy proxy entry (the z-image
session has no `repair`), so nothing pins it yet; implementing it is a
follow-up amendment, not a silent extension of this one.

### A mint defect this fixture exposed, fixed alongside

A definition's interior `links` are serialized by the frontend as OBJECTS
(`{id, origin_id, origin_slot, target_id, target_slot, type}`), not the
top-level tuple form. `mintDefinition` keyed every interior link by `link[0]`,
which reads `undefined` off an object, so every interior link of a real
template collapsed onto the one key `"undefined"` and the round trip emitted
the last link N times. The verbatim z-image turbo template did not round-trip.
Keys are now the tuple's `[0]`, an object's `id`, or the mint position for an
id-less entry. Pinned by `mint/project round-trips a definition's interior
links in the frontend's OBJECT form` and by the corpus session, whose
`base_workflow` is the verbatim template.

### `SCHEMA_VERSION` is NOT bumped — the reasoning, for review

No new root, no new per-node key: the opaque key is A2's, and a host array on
a subgraph instance is precisely the case A2 introduced it for (a non-empty
positional array for a class the catalogue does not describe — every
post-migration template already mints that way). What is new is a per-node
STATE TRANSITION: an instance minted with `widgets_values: []` (an empty named
map) becomes opaque on its first host write. A reader at A2 or later projects
both states correctly; the transition is additive and the old state remains
valid. A reader older than A2 could not read the pre-existing opaque nodes
either, which A2 already recorded as the ordinary consequence of a SHA-pinned
consumer moving its pin.

### Guarded by

`test/promoted-host-writes.test.ts` (materialize/align, one-slot second
write, entries-win extension, opaque single-key layout, bounded writes,
replay idempotency, LWW both orders, commuting different-index writes, the
un-unified interior register, delete-wins, shared-definition top-level OK /
nested rejected, `interior_node_not_found`, eleven `malformed_op` shapes with
byte identity, `catalog_required`, opaque-without-catalogue, the named
fallback, `uncatalogued_widget_write`; connect: materialize + wire, socket-only,
reuse by name, reuse of a mint-time entry, LWW both orders, replay, both
delete-wins axes, malformed grow, host write + wired input coexisting;
object-form definition links round trip; the shapes type-check without
casts), four rows in `test/ka4-rejection-byte-identity.test.ts`, and
`fixtures/session-promoted-host.session.jsonl` — ops MINTED AND FINALIZED BY
comfy-cli at the pinned revision against its own object_info fixture, with
the verbatim gallery template as `base_workflow`, replayed through this
applier by `test/replay.test.ts`.

### Consumer impact

`services/agent/dochost` pins this package by SHA and the agent image pins
comfy-cli separately; a doc host at the old pin rejects every host write with
`uncatalogued_widget_write` and every promoted connect… applies it as an
ungated autogrow. **Both pins move in the same change — the applier first,
then the CLI**, as A1 already requires. comfy-cli's side is the #815 + #818 stack, merged to main as
`ba0b0b92abcc86b01e8a6704d07088f92afe7aa7` (amendment v1.5): the promoted-grow
gate, the full-name register, and the positional `legacy_primitive` payload;
the pins above cite that merge commit. §14.4's `promoted.repair` is the one
piece this package does not yet apply (OPEN above).

## Amendment A16 — 2026-08-28 — DQ-11 incarnation-namespaced widget stamps

**Touches:** §1.1, §3, §4, and §10. This amendment is the enactment of DQ-11
option (c) and KEEP-ALIVE 4.

Each node map carries the internal `__incarnation` string. Nodes imported by
`mint()` and v1 documents upgraded by `migrate(doc, 1)` use the deterministic
legacy token `"0"`. A modern winning `add_node` carries a creator-chosen
`node_incarnation` (normally that add operation's immutable `op_id`) as the new
incarnation token. Legacy adds without the field remain life `"0"`. The token
is never projected into workflow JSON.

The creator carries `node_incarnation` on node-scoped widget writes. A
top-level or interior `set_widget` whose token does not equal the addressed
node's current token is a consumed no-op and cannot write a stamp. The same
rule applies to the widget register embedded in a `connect` with
`grow.inputcount`. Missing `node_incarnation` is the legacy v1 translation to
`"0"`; it is retained only so historical ops remain replayable.

Widget target keys now include the incarnation:

```text
["widget", String(node_id), node_incarnation, widget_name]
["widget", resolved_path, node_incarnation, inner_widget]
```

This prevents a life-1 stamp from contending with any life-2 write while
preserving ordinary same-incarnation LWW. The v1→v2 migration adds the legacy
node token and inserts `"0"` into existing widget target keys. This is a
persisted document-layout and semantic-op contract change, so `SCHEMA_VERSION`
is 2 and old readers fail closed.

The shared package does not own the WebSocket envelope version. Cloud/FE
integration must treat `node_incarnation` as a protocol-v2 compatibility
requirement before durable or offline queues are public: v1 transport may be
translated only with the documented legacy token `"0"`, and mixed readers must
not silently exchange the new semantics. This amendment does not implement a
transport `v == 2` decoder.

---

## Amendment A17 — 2026-08-29 — DQ-10 direct Lamport counter semantics

Private alpha keeps one op format and assigns Lamport semantics directly to its counter:

```text
winner   = [counter, actor, op_id]
counter  = op.base_version, creator-owned and durably advanced
```

The existing tuple comparator is reused unchanged; no second comparison
implementation is introduced.

This is a direct private-alpha semantic change, not a v2→v3 migration.
Amendment A16's incarnation-qualified target keys remain byte-for-byte the
register namespace, including legacy incarnation token `"0"`. Same-lineage
reconnect continues to use state-vector delta replay.

---

## Amendment A18 — 2026-08-30 — normalized stamped link identity

Every `connect` claims `("link", String(link_id))`. Distinct raw ids such as
`700` and `"700"` therefore contend for one scalar register. The greatest
embedded `[base_version, actor, op_id]` stamp owns the complete LiteGraph tuple
and all coherent input/output references; fields never merge across writers.

The gate runs before endpoint mutation. A loser is dropped whole. A new winner
first removes the prior normalized tuple and every normalized-id endpoint
reference, then installs its own tuple and exactly its own references. The
separate input register still decides whether that identity may occupy the
requested destination; losing that gate leaves no tuple or dangling reference.
This adds an internal `__stamps` key, not a root-layout change, so
`SCHEMA_VERSION` remains 2.

---

## Amendment A19 — 2026-09-03 — durable link intent across node lifetimes

The A18 link-identity row retains the complete tuple it already owns:

```text
["link", String(link_id)] -> [counter, actor, op_id, complete_link_tuple]
```

`links` remains only the materialized live-link set. A winning node deletion
may remove an incident tuple from `links` without erasing its A18 intent. When
a higher-stamped `add_node` makes both endpoints present again, the applier
rematerializes each intent whose destination-input register still authorizes
the same stamp. `mint()` seeds an intent row for every imported live link so
the common bootstrap snapshot carries the same authority.

Explicit severance remains different from temporary dematerialization. Every
normalized id named by `delete_node.removed_links`, and every live incumbent
removed by a winning `disconnect`, records terminal retirement:

```text
["link_retired", String(link_id)] -> [counter, actor, op_id]
```

A retired id cannot materialize again. Replacing an input's incumbent is not
explicit severance and must not write retirement; the destination-input stamp
already makes the displaced intent ineligible. These rules preserve A7's
ungated named-link severance while closing the seeded-snapshot race where
`[add@9, delete@5 removed_links:[999]]` kept an incident link in one arrival
order and permanently lost it in the other.

No root name or root type changes. This is a direct private-alpha semantic
change under A17, not a schema-v3 document, v2-to-v3 migration, compatibility
shim, or dual-format reader; `SCHEMA_VERSION` remains 2. Pre-change private
alpha documents without tuple-bearing identity rows must be re-minted rather
than having hidden intent inferred. See ADR-022.
