# @comfyorg/comfy-multi-player

One implementation of what an edit does to a workflow document, used
identically by the ComfyUI frontend and by the server that hosts the document.
It exists so that an agent and a human can edit the same workflow at the same
time without either one silently overwriting the other.

Pure TypeScript. `yjs` is the only runtime dependency — no DOM, no framework,
no litegraph, so the same code runs in the browser bundle and in a bare Node
server process.

**Normative reference: [`docs/multiplayer-schema.md`](docs/multiplayer-schema.md)**
— the document layout, the op semantics, and the reasoning behind every rule.
This README is the orientation and the API surface; where the two disagree, the
schema document wins.

---

## The model in 60 seconds

Three things:

| | What it is |
|---|---|
| **workflow JSON** | What ComfyUI loads, saves, and executes. |
| **document** | A `Y.Doc` holding the same graph in a form that merges. You never edit its Yjs types directly. |
| **op** | One stamped edit — "set widget `steps` on node 4 to 30". Ops are the only way to change a document. |

The loop is: mint the document once, send ops, apply them, project back to
workflow JSON, render that.

```ts
import * as Y from "yjs";
import { mint, applyOps, project } from "@comfyorg/comfy-multi-player";

const doc = mint(workflowJson, catalog, "object_info@2026-08-01");

const result = applyOps(doc, [op], catalog);
// { outcomes: [{ op_id: "...", outcome: "applied" }], ops_seen: 1 }

const workflow = project(doc, catalog); // ComfyUI workflow JSON, ready to render
```

Every replica of a document forks from **one** minted snapshot:

```ts
const follower = new Y.Doc();
Y.applyUpdate(follower, Y.encodeStateAsUpdate(hostDoc));
```

Do not call `mint()` twice on the same workflow to produce two replicas. Two
independent mints create Yjs structures with different internal identities, and
merging them is lossy. Under the v1 layout the loss is **silent whole-node
clobber**, not doubling: nodes and links are `Y.Map`s keyed by id, so two mints
of the same base resolve to last-writer-wins at each key and a diverged
replica's edits are simply overwritten. (Doubling is the `Y.Array` form of the
same hazard — schema §9 — and it does not apply to the v1 seeds; see
`docs/INVARIANTS.md` KA-10, where both halves are measured rather than assumed.)
Each side looks correct alone, so this is silent until the merge.

## 0.2.0 release scope

Version 0.2.0 is a breaking release because it replaces the 0.1.0
`ApplyResult` shape with ADR-007's ordered, discriminated outcomes and renames
the old version-like count to `ops_seen`. It also adds ADR-008's explicitly
passed, caller-owned event sink and the public event schema surface:
`AGENT_EVENT_JSON_SCHEMA`, `CMP_EVENT_SCHEMA_VERSION`, `AgentEvent`,
`CmpEvent`, `CmpEventType`, `CmpEventSink`, and `CmpCallContext`.

ADR-011 also makes reconnect behavior explicit: an ordinary sequence gap or
reconnect reuses the existing follower document and recovers through
state-vector delta replay. Only an explicit `doc_reset` lineage break may
replace the document, after every projector has received the reset.

## The catalog, and why every call takes one

Ops address widgets by **name** (`steps`), workflow JSON stores them by
**position** (`widgets_values[2]`). The mapping between the two lives in
`object_info`, not in the document — so a catalog is an argument to almost
everything here.

```jsonc
// fixtures/catalog.json — the shape
{
  "types": {
    "KSampler": { "widget_order": ["seed", "control_after_generate", "steps", "cfg", …] },
    "BatchImagesNode": { "widget_order": [], "autogrow_templates": { "images": { "prefix": "image" } } }
  }
}
```

A document records the catalog identity it was minted against in
`meta.catalog_version`. Projecting with a **different** catalog silently
permutes widget values — `cfg` renders the steps value — because the same
name-keyed map resolves to different positions. Pass the catalog the document
pins.

## API

### `mint(workflow, catalog, catalogVersion = ""): Y.Doc`

Imports an existing workflow JSON into a fresh document and stamps
`schema_version` + `catalogVersion` into `meta`. `project(mint(w, c), c)`
deep-equals `w` after canonicalization (nodes and links sorted by id).

Throws (`TypeError`) on a workflow that collides with a reserved meta key, or
whose node carries more `widgets_values` entries than its class has widget
names in the catalog.

### `applyOps(doc, ops, catalog?, context?): ApplyResult`

Applies a batch, one Yjs transaction per op, in the given order. Never throws
for a rejected op — every outcome comes back in the result. See
[outcomes](#what-applyops-returns) below.

`catalog` is optional but effectively required for a real host: without it, an
`add_node` carrying positional widget values is rejected `catalog_required`,
and unknown widget names are no longer caught.

`context` may carry ADR-008's caller-owned `eventSink`. The sink receives
versioned, JSON-safe `CmpEvent` diagnostics and cannot change semantic results;
there is no global registration or package-owned telemetry state. The API also
exports the host event contract (`CMP_EVENT_SCHEMA_VERSION`, `CmpEvent`,
`CmpEventType`, `CmpEventSink`, and `CmpCallContext`) and the agent broadcast
event schema (`AGENT_EVENT_JSON_SCHEMA` and its event types).

### `project(doc, catalog): WorkflowJSON`

Read-only with respect to the document's CONTENT, byte-stable for a given
document state, so the browser and the server render identical JSON.
Canonicalization: nodes and links sorted by id; the name-keyed widget map
assembled into positional `widgets_values` (missing names project as `null`);
`outputs[].links: null` preserved verbatim, never coerced to `[]`; every
unrecognized workflow key passed through untouched.

**Fails closed on the schema version FIRST (KA-11).** Before it reads any
workflow content it throws `SchemaVersionError` when `meta.schema_version` is
absent, is not a positive integer, or is not this package's `SCHEMA_VERSION`. A document
NEWER than this package is refused rather than best-effort projected; a
document OLDER is refused too, and the message names the remedy — run
`migrate(doc, storedVersion)` on the **host** first, then read. `project()`
never migrates, because it is a read any replica may call — a browser follower
included — and a follower must not write the shared document (KA-6/FC-5). No
follower calls it today (the frontend does not depend on this package at all),
so this is a rule about the API, not an observation about callers.

This refusal is byte-exact: `encodeStateAsUpdate(doc)` and the `doc.share` key
set are both unchanged. It is also strictly *less* mutating than the old
behaviour — before the gate, `project()` typed all four roots on every call, so
projecting a root-less document materialized `meta`/`nodes`/`links`/
`definitions`; now it refuses first and touches none of them. Consequence for callers: `project(new Y.Doc(), catalog)` used to
return `{nodes: [], links: []}` and now throws. Bootstrap with the public
`mint()` API (schema §9); `migrate()` is not an escape, it refuses the same
document. The source-internal `initDoc()` helper is not a consumer bootstrap API.

Then throws (`TypeError`) if a node has widget values whose class the catalog
does not describe — see [`opaque_widgets`](#opaque-widgets) for the case that is
handled instead of throwing.

One caveat on "pure", stated because the word invites the wider reading: on the
ACCEPT path `project()` still types the `nodes`/`links`/`definitions` roots
unconditionally, and `Y.Doc#getMap` registers an absent root in `doc.share`. On
a snapshot-forked replica (§9) that legitimately lacks `definitions`, a
successful `project()` therefore grows the `doc.share` key set. Nothing is
encoded — an empty root is zero bytes, so `encodeStateAsUpdate` is unchanged
and nothing goes on the wire — and this is unchanged from before the schema
gate existed. It is the `migrate()`-side defect (#20) one function over, and it
is tracked separately; do not read "pure read" as "leaves `doc.share` alone" on
the accept path.

### `migrate(doc, fromVersion): void`

Document-layout versioning, and the **migration path** a host runs before it
reads a document it did not mint. `SCHEMA_VERSION` is `1`, so today there is
nothing to step: the call validates and no-ops at v1, and throws
`SchemaVersionError` for everything else. A host never best-effort reads a
layout it does not know.

`migrate()` is **no longer the only fail-closed read gate** — it was, and
nothing forced a caller through it, which is the fail-open gap #38 closed by
putting the same check inside `project()`. Both entrypoints share one
definition of the read (`readSchemaVersion`), so they agree on exactly which
documents are unreadable. `migrate()` remains **host-only**: followers receive
a migrated document over the struct stream or as a new epoch (schema §10).

`fromVersion` is your *claim* about the document, and it is checked against the
document's own `meta.schema_version`. It throws when:

- `fromVersion` is not an integer ≥ 1, or is greater than `SCHEMA_VERSION`
  (deliberately: a document newer than the code is refused, never read);
- `meta.schema_version` disagrees with `fromVersion`;
- **`meta.schema_version` cannot be read at all** — no `meta` root, a `meta`
  root without the key, or a value that is not a positive integer. Such a
  document is rejected, not assumed current. Every document `mint()` produces
  carries the key, and so does every replica forked from a minted snapshot, so
  this is a malformed document rather than a shape a host can produce (schema
  Amendments A3 and A5).

### `readSchemaVersion(doc): number | undefined` / `assertReadableSchema(doc, context): void`

The KA-11 read gate, exported for a host that wants to refuse a mismatched
document with its own structured error **before** it reads, rather than by
catching a throw. `readSchemaVersion` returns the document's own claim, or
`undefined` when there is no readable one (absent `meta` root, absent key, or a
value that is not a positive integer); it materializes nothing.
`assertReadableSchema` is the throw form `project()` and `migrate()` both use —
`context` names the entrypoint in the message.

One caveat on the error type, from Amendment A3 and true of every entrypoint
here: a document whose `meta` root was integrated as a different concrete Y
type surfaces Yjs's own constructor-clash `Error`, not a `SchemaVersionError`.
Still fail-closed, still a throw, but match on that possibility too.

Both outcomes are byte-exact: a no-op and a rejection each leave
`encodeStateAsUpdate(doc)` unchanged and materialize no root type. It checks the
schema version and nothing else — it does **not** inspect the `nodes`/`links`/
`definitions` roots, so a document malformed below `meta` fails at the read that
touches it (`project`, `applyOps`), not here. It is host-only: a follower
receives the migrated document over the struct stream and must not call this.

### Stamp machinery

`stampKey(op)`, `compareStampKeys(a, b)`, `writeTarget(op)`,
`stampTargetKey(op)`, `codePointCompare(a, b)`. You need these only if you are
building conflict UI or your own bookkeeping — `applyOps` uses them internally.

### Follower read surface and document internals

The entrypoint exports the op layer (`mint`, `applyOps`, `project`, `migrate`),
the KA-11 read gate, the stamp machinery above, the ADR-004 follower read
surface (`nodesMap`, `linksMap`, `OPAQUE_WIDGETS_KEY`), KA-1's `encodingLosses`
diagnostic, the payload bounds (`MAX_OPS_PER_BATCH`, `MAX_PAYLOAD_DEPTH`,
`MAX_COLLECTION_ENTRIES`, `MAX_OP_COST`, `opBoundsRefusal`), the safer snapshot
surface below, and the types. That is the whole public surface.

The three layout exports are a deliberate exception for the frontend follower
documented by ADR-004. They are read-only by contract: that follower consumes
the host's layout and never writes the shared document or calls `applyOps`.
`initDoc`, `definitionsMap`, `metaMap`, `appliedMap`, `stampsMap`,
`createNodeMap`, `resolveDefinition`, `countDefinitionInstances`,
`isOpaqueWidgets`, `WIDGET_STORAGE_STRATEGIES`, `WidgetStorage`,
`widgetStorageFor`, and `widgetStorageOf` were re-exported through an earlier
release and are now module-private.

Read-only intent was never the problem; reachability was. The same import that
hands you `nodesMap` for a read hands you a live `Y.Map` you can write, and a
write that does not go through `applyOps` carries no stamp, so it is invisible
to ordering, to the last-writer-wins tiebreak, and to duplicate-op rejection.
One replica mutating outside the op layer diverges from every other replica
with no diagnostic. See [issue #18][issue-18] and KA-1, KA-2, KA-4, FC-5 in
[docs/INVARIANTS.md](docs/INVARIANTS.md).

General consumers should call `project(doc, catalog)` for canonical workflow
JSON, or use the safer snapshot surface below when projection cannot serve the
read. There is no `./doc` subpath export and none will be added; of `doc.ts`
only ADR-004's three deliberate layout exports and KA-1's `encodingLosses`
remain reachable from the entrypoint.

[issue-18]: https://github.com/Comfy-Org/comfy-multi-player/issues/18

### Reading without a handle

`project(doc, catalog)` is the full read and the first thing to reach for. Some
callers cannot use it: a follower renders a document it has no catalog for, and
a host's pre-apply guards run *before* it knows projecting is safe. For those,
the entrypoint exports a snapshot surface that returns **plain, deep-frozen,
deep-copied data** — never a live Yjs type, at any depth.

| | |
|---|---|
| `readGraph(doc)` | `{ nodes, links }` keyed by `String(id)`. Each node carries `type`, `pos`, and `widgets` (name-keyed) or `__widgets_opaque`. Not the whole node — see below. |
| `readMeta(doc)` | The `meta` root: `schema_version`, `catalog_version`, id high-water marks, and the §6 passthrough keys. |
| `docCatalogPin(doc)` | The catalog SHA the document was minted with, or `""` when there is none to compare (KA-12). |
| `hasNode(doc, id)` | Whether a node id already exists. |
| `hasAppliedOp(doc, opId)` | Whether the document already applied this op — tells a genuine conflict from an idempotent replay. |
| `appliedOpIds(doc)` | Every applied `op_id` (a set, not an order). |
| `readStamps(doc)` | The LWW ledger: write-target key → `[base_version, actor, op_id]`. |
| `OPAQUE_WIDGETS_KEY` | The reserved key above, as a constant, so consumers do not hardcode it. |

Three properties hold mechanically, and `test/readonly-surface.test.ts` proves
each by attempting the violation:

- **No live handle escapes.** Nothing reachable from a return value is a
  `Y.AbstractType`.
- **It is a copy, not a view.** `Y.Map#get` hands back the object stored inside
  the Yjs item, so returning it would let `snapshot.nodes["7"].pos[0] = 9` edit
  the document in place. Every non-primitive is rebuilt.
- **It is deep-frozen.** A write attempt throws `TypeError` instead of silently
  no-oping.

Reads also never materialize a root: `Y.Doc#getMap` *creates* the root it names,
and a follower's document before its first frame has none, so every accessor
checks `doc.share` first.

And this is not a way around the KA-11 read gate. `project()` refuses a document
whose `meta.schema_version` this package cannot read; these functions read the
same layout by the same key names, so they refuse it too — same
`SchemaVersionError`, same predicate — **when the document carries content**. A
document that carries *nothing* still reads as empty, because that is the
follower's pre-first-frame document and there is nothing there to mis-key.

That last clause is the one place the two paths differ, and it differs in
disposition, not in predicate: for a content-free document `project()` refuses
where these functions return empty (Amendment A12).

If you want a structured error rather than a throw, **catch
`SchemaVersionError`** — that is the supported pre-check and it is exact.
`readSchemaVersion(doc) === SCHEMA_VERSION` is a usable approximation but it is
*stricter* than the gate: it is `undefined` for the pre-first-frame document
too, so a host gating on it alone refuses precisely the document the empty
clause exists to allow.

`readGraph` deliberately returns a **subset** of each node's fields — the ones a
follower renders — not the whole node. Copying every field costs about twice as
much per frame for data nobody reads (`node scripts/bench-read.mjs 200`); adding
a key is a one-line change, and `project()` remains the full-fidelity read.
Subgraph definitions are not exposed: no consumer reads them, and an unread
export is future reachability.

None of this is a write path. Shared state changes through `applyOps`, and
nothing else.

## Ops

Every op carries the same envelope, minted by its creator before dispatch:

```jsonc
{
  "op": "set_widget",
  "op_id": "9f2c…",          // uuid4 hex, 32 lowercase chars — never regenerated
  "actor": "human:u_41ab:tab_2",
  "base_version": 7,          // document version the op was minted against
  "stamp": [7, "human:u_41ab:tab_2"]
}
```

Six kinds, frozen:

| Kind | Payload beyond the envelope | Batchable (authoring) |
|---|---|---|
| `add_node` | `node_id`, `class_type`, `pos`, `node` (the complete node object, inserted verbatim) | yes |
| `connect` | `link_id`, `from_node`, `from_slot`, `to_node`, `link_type`, then EITHER a numeric `to_slot` (`ConcreteConnectOp`) OR a `grow` payload with `to_slot` null/absent (`GrowConnectOp`); `grow.promoted: true` names a subgraph instance's DECLARED input, materialized on the instance and LWW-gated as one register (schema Amendment A15) | yes |
| `disconnect` | `link_id`, `to_node`, `to_slot`; claims the same concrete input register as `connect` and removes the winning slot occupant | yes |
| `set_widget` | `node_id`, `widget` (name, never index), `value`, optional `old`; an interior write adds `path` AND `inner_widget` together (`InteriorSetWidgetOp`); a promoted HOST write adds `promoted: {value_index, instance_path, host_widgets_values}` instead — a positional write into a subgraph instance's opaque array (schema Amendment A15) | yes |
| `delete_node` | `node_id`, `removed_links` | yes |
| `clear` | `removed_nodes` | no |
| `reset_doc` | see [open questions](docs/api-contract-proposal.md) — currently rejected `op_deferred` by this package | no |

`FROZEN_OPS`, `DEFERRED_OPS`, and `BATCHABLE_OPS` are exported so you can check
programmatically rather than hard-coding the lists, along with the matching
`OpKind` / `FrozenOpKind` / `DeferredOpKind` / `BatchableOpKind` types.
Compile-time assertions in `src/types.ts` pin that `FROZEN_OPS` is exactly
`Op["op"]`, that `DEFERRED_OPS` is exactly `DeferredOp["op"]`, that their union
is exactly `WireOp["op"]`, and that `BATCHABLE_OPS ⊆ FROZEN_OPS`, so the lists
and the unions cannot drift apart silently.

**`Op` vs `WireOp`.** `Op` is what `applyOps` implements — the six kinds it
can actually apply. `WireOp` is `Op` plus the deferred kinds a conforming peer
may legally put on the wire, and it is what `ApplyFailure.op` and the stamp
helpers take: a rejected `reset_doc` really does land in `failed.op`, so typing
that field `Op` claimed something false. Ask the applier for an `Op`; model
what arrives as a `WireOp`; and keep a `default` arm either way, because a peer
built against a newer vocabulary can send a kind that is in neither. A host
holding received ops as `WireOp[]` casts at the call to `applyOps` — that cast
is the wire boundary, and `validateEnvelope` is what stands behind it.

Migrating a call site: if you hold `to_slot: number | null` and `grow` in one
variable, narrow on `grow` before constructing; if you hold `path: string[]`,
an interior write needs a non-empty tuple. The compiler's message points at
whichever variant it tried last, so read it as "this matches neither variant"
rather than as a complaint about the single field it names.

Several field combinations that no conforming producer mints are also
unrepresentable rather than merely discouraged: `grow` with a numeric
`to_slot`, a `to_slot` of `null` with no `grow`, `path`/`inner_widget` without
each other, and an empty `path`. The four sub-union members are
`ConcreteConnectOp` / `GrowConnectOp` and `TopLevelSetWidgetOp` /
`InteriorSetWidgetOp`. `test/types/invalid-states.negative.ts` is the checked
list and `test/type-negatives.test.ts` is the gate.

**This binds TypeScript callers only, and it is not a wire guarantee.** JSON
does not type-check, so what protects the document is the applier, and it does
not reject all four: `to_slot: null` with no `grow` and a non-empty `path` with
no `inner_widget` are `malformed_op`, while `grow` with a numeric `to_slot` and
an `inner_widget` with no `path` are **accepted and silently mishandled** —
the first grows its own slot and never reads `to_slot`, the second writes the
top-level `widget`. Tightening either would change what is legal on the wire
and needs a comfy-cli counterpart, so it is deliberately not done here.
`test/invalid-op-states.test.ts` pins the exact behaviour of every case,
rejected and accepted alike.

An op kind this build does not know — one minted by a peer built against a
newer vocabulary — is **rejected loudly**, never silently dropped: `applyOps`
returns `failed.code === "unknown_op"`, that op applies nothing and consumes no
`op_id`, and the remainder of the batch is abandoned. Ops **before** it in the
batch stay applied, per "Batches abort the remainder" below; the document is
byte-identical only when the unknown op is the first in the batch.

**"Batchable" is an authoring-surface rule, and `applyOps` does not enforce
it.** The column above is comfy-cli's: `clear` and `reset_doc` rewrite the whole
document, so a batch of edit *specs* containing either is rejected whole by
`apply_specs` before any op is minted. `applyOps` is the other surface — it
replays already-minted ops under [abort-remainder](#what-applyops-returns), the
same as comfy-cli's `apply_op`, which replays `clear` in any position. So a
`clear` in the middle of an op array is applied here, deliberately: the
`edit-heavy` conformance session contains exactly that, and
[`docs/portability.md`](docs/portability.md) requires every language
implementation to replay it with no failures. If you are building a submission
surface in front of the applier, that admission layer is where `BATCHABLE_OPS`
belongs. `test/batch-policy.test.ts` pins all of this.

The normative definition of the op envelope and the six kinds is
`docs/op-vocabulary-v1.md` in
[comfy-cli](https://github.com/Comfy-Org/comfy-cli), which mints these ops on
the agent side. The `Op` types here mirror those minted shapes field for field;
a divergence is a bug here.

This package tracks that document at comfy-cli commit
`7e732242d971daf0d2d30f22f997abfacd78986e`, plus amendment v1.2 (§11) at
`1201b676275ce7e9b5cdb90f135b6e115ba9df10`. Cross-repository citations are
pinned by SHA and never by branch (FC-10): the branch this package used to cite
was deleted upstream, and a citation that re-targets is how a frozen contract
drifts without anyone noticing. Every `§` quoted here is a section of the pinned
revision. [`docs/upstream-pins.json`](docs/upstream-pins.json) is the registry —
how each SHA was established, which files cite it, and which upstream amendments
post-date the pin and are therefore **not** implemented here (the `reset_doc`
status is one; see [Q5](docs/api-contract-proposal.md)). `npm run check:pins`
holds the citations and the registry to the same SHA.

There is **no** op for groups, node positions after creation, pan, or zoom.
Those edits are not expressible and do not travel on the op channel.

## What `applyOps` returns

```ts
interface ApplyResult {
  outcomes: ApplyOutcome[]; // one ordered outcome for every submitted op
  ops_seen: number;         // total op identities this document has consumed
}

type ApplyOutcome =
  | { op_id: string; outcome: "applied" }
  | { op_id: string; outcome: "no-op" }
  | { op_id: string; outcome: "lww-dropped" }
  | { op_id: string; outcome: "rejected"; reason: { code: string; message: string } };
```

Six outcomes, and the distinction between them is the part integrators get
wrong:

| Outcome | Reported in | Document changed | `op_id` consumed |
|---|---|---|---|
| Applied | `outcome: "applied"` | yes | yes |
| **Dropped by last-writer-wins** — a higher stamp already owns that target | `outcome: "lww-dropped"` | no | yes |
| **Delete-wins no-op** — the target node is gone | `outcome: "no-op"` | no | yes |
| **Malformed on its face, whatever the document state** — `connect` with a `from_slot` or `to_slot` outside the non-negative integers, a non-numeric `to_slot` without `grow`, a non-string `link_type`/`grow.name`/`grow.type`/`grow.inputcount.widget`, a non-cloneable widget value, or a `base_version` that throws on conversion | `outcome: "rejected"` with a structured `reason` | no (byte-identical for this op; a valid prefix earlier in the batch is still applied — §4) | **no** |
| Duplicate — already applied to this document | `outcome: "no-op"` | no | already was |
| Rejected | `outcome: "rejected"` with a structured `reason` | no (byte-identical) | **no** |

Amendment A9 refuses cloneable-but-unstorable values,
invalid `connect.link_id`, and non-iterable `delete_node.removed_links` before
mutation. Amendment A10 rejects reference cycles before they can enter the
document. Amendment A14 shape-validates `connect.link_type` before any write;
arbitrary strings remain legal.

The four `connect` paths this row used to except — the two `output_slot_missing`
cases and the two `connect`+`inputcount` grow rejections, swept by
`test/ka4-rejection-byte-identity.test.ts` — **now hold**, and are additionally
order-independent (schema Amendment A6).

`applied` means "this document is done with that op_id", not "your value won".
A client that renders optimistically must clear a pending op when its effect
arrives on the update stream, not when the ack lists it as applied.

**Batches abort the remainder.** If op *k* fails, ops 0..*k*-1 stay applied and
ops *k*..*n* are not applied at all. Fix the failing op and resend the whole
batch with the **same** `op_id`s: the prefix comes back in `skipped`, the
remainder applies. Rejected ops consume no `op_id`, so a batch is retryable.

**The four `connect` rejections that used to break this are fixed (#34).**
`output_slot_missing` with an empty destination slot, `output_slot_missing` with
an occupied one (which used to sever the incumbent link before rejecting), and
the two `connect`+`inputcount` grow rejections all leave the document
byte-identical now, and are swept as ordinary rows in
`test/ka4-rejection-byte-identity.test.ts`. Yjs does not roll a `transact` body
back on throw, so this is a property of write order inside each handler, not
something the transaction provides — which is why it had to be fixed by moving
checks rather than by wrapping them.

Rejection codes: `malformed_op`, `unknown_op`, `op_deferred`,
`catalog_required`, `invalid_node_payload`, `unknown_widget`,
`uncatalogued_widget_write`, `opaque_widgets`, `widget_out_of_range`,
`input_slot_missing`, `output_slot_missing`, `not_a_subgraph`,
`interior_node_not_found`, `shared_definition_unforked`, and `apply_failed` for
anything unexpected. Match on `code`, never on `message`.

`uncatalogued_widget_write` means a NAME-KEYED widget write named a class the
pinned catalog does not describe. `add_node` and `set_widget` (and `connect`'s
`grow.inputcount` bump, which routes through the same check) apply this rule
identically — the write would create widget state `project()` cannot turn back
into positional values, which would make the whole document unprojectable on
every later read. A POSITIONAL `widgets_values` array for an uncatalogued class
is a different case and is still accepted: it is stored opaquely and
round-trips verbatim (see [`opaque_widgets`](#opaque-widgets)).

## Rules a client must follow

These are load-bearing. Each one has a failure mode that is silent if you skip
it.

1. **Every expressible edit is minted as an op** with an `op_id` generated
   client-side before dispatch. Never re-mint an `op_id` on retry — it is the
   final tiebreak in conflict resolution and the key that makes redelivery
   safe.
2. **Never mutate the shared document's Yjs types from the client.** An
   optimistic overlay is presentation-only: apply your pending ops to a local
   shadow, never encode that shadow as a Yjs update, never merge it back.
   Exchanging struct updates between two replicas that applied ops
   independently corrupts both the values and the conflict bookkeeping.
3. **Retry means the same batch with the same `op_id`s.** At-least-once
   delivery becomes exactly-once per document through the `op_id` gate.
4. **Fork every replica from one snapshot** (see above).
5. **Project with the catalog the document pins.**
6. **Edits the vocabulary cannot express do not become ops** — groups, live
   drag positions, and camera state live outside this document.

## What is guaranteed

For any set of ops and any two arrival orders, the projections come out equal.
Concretely, pinned by the test suite (`npm test`):

- **Idempotent per `op_id`.** Re-applying an entire recorded session leaves the
  document byte-identical.
- **Widgets are addressed by name**, never by index, so two writers editing the
  same widget resolve to one value instead of corrupting the node. The
  measurement that forced this: two writers editing the same index of a
  7-element `widgets_values`, exchanged as Yjs structures, merged into a
  **length-8** array — every widget after the contested one shifted by one
  position, so `cfg` read the steps value.
- **Node identity compares as a string.** `7` and `"7"` are the same node
  everywhere, including in conflict keys.
- **Concurrent `connect` to one concrete input converges.** An input is a
  last-writer-wins register; the winner retires the displaced link whole; the
  loser writes nothing.
- **Delete wins** over concurrent updates, silently. An op naming a node that
  is gone is a no-op, not an error — **provided the op itself is well formed.**
  Validation that depends only on the OP (issue #10 / schema Amendment A6) runs
  before the delete-wins return, so an op that is malformed on its face is
  rejected rather than recorded as an applied no-op. Otherwise whether an op
  was rejected would depend on which replica had already seen the delete, and
  under §4 abort-remainder the two would then disagree about the rest of the
  batch as well. Checks that must READ the deleted node — slot ranges, opaque
  widget storage, the catalogue lookup — necessarily still resolve differently;
  schema §2.5 items 4-8 carve that out explicitly — 4 and 5 for `connect`, 6 for `set_widget`, 7 for `add_node`, 8 for interior path resolution — and §2.5 now states the general RULE those items illustrate.
- **Rejection is loud.** An op that is unsatisfiable against a live target is
  rejected, never silently dropped.

### Known carve-outs

Stated rather than implied; each has a test that will start failing the day it
is closed.

1. `outputs[].links` is a set projected as an arrival-ordered array. Two
   connects out of one source into two different inputs produce the same set in
   two sequences. Nothing is lost or invented; a byte comparison still differs.
2. An autogrow `connect` grows a slot instead of writing a register, so racing
   a delete of its source leaves the slot present in one order and absent in
   the other. Two concurrent autogrows also take their display names by arrival
   order.
3. Two `add_node` ops with the same `node_id` and different payloads resolve
   first-writer-wins. Minted ids are random 53-bit integers, so this is
   reachable only from hand-authored or replayed streams.
4. Two writes to the same target **inside one batch** share a `base_version`,
   so they resolve by `op_id`, not by position in the batch. "Last spec wins"
   is not true.
5. An interior write into a subgraph definition that more than one node
   instantiates is **rejected** (`shared_definition_unforked`), where comfy-cli
   forks the definition instead. Schema §5.3 keeps forking OPEN and requires the
   rejection until it is specced. Instances are counted by the definition the
   node's `type` **resolves** to, so two nodes spelling one definition
   differently — its id and its unique display name — are two instances. A
   display name the pinned catalog describes as a node class is *not* a
   spelling of the definition: naming a subgraph after the node it wraps is
   common, and those nodes are classes, not instances.
6. A `connect` refused by a check that must READ a node — `from_slot`/`to_slot`
   out of range or not addressing a slot record, an opaque widget destination,
   or a `grow.inputcount.widget` the catalogue cannot describe — racing that
   node's deletion is rejected by a replica that still holds the node and
   accepted as a delete-wins no-op by one that does not. Checks that depend on
   the OP ALONE are hoisted above the delete-wins return and do not carve out.
   Schema §2.5 items 4-8, Amendment A6 — the same shape recurs in
   `set_widget` (item 6), `add_node` (item 7) and interior path resolution
   (item 8), and §2.5 states the rule they illustrate.

This list and the schema's are the same list seen from two sides: schema §2.5
enumerates eight; items 1-3 map one-to-one, schema items 4-8 are folded into
item 6 here, item 4 above is the intra-batch `base_version` case (which the
schema states in §3 instead), and item 5 is the §5.3 shared-definition rejection.

### Opaque widgets

`Note`, `MarkdownNote`, and any other frontend-only class never appear in
`object_info`, so no catalog can describe them. Their `widgets_values` is
stored whole under one reserved key and projected back verbatim. This does not
reintroduce the positional corruption above: a whole value is never merged
element-wise, so two concurrent writes resolve as whole-value
last-writer-wins — which is what you want for a sticky note.

The cost is that such values are not name-addressable: a `set_widget` against
one is **rejected** with `opaque_widgets` rather than silently doing nothing.

## Purity

This package runs in the browser bundle and in the server process, so it must
stay free of UI frameworks, DOM implementations, and litegraph.
`npm run check:purity` (CI-gated) asserts the declared and resolved production
dependency roots are exactly `{yjs}`, walks the fully resolved dependency tree
and fails on any banned package, then imports the built entrypoint in a bare
Node subprocess and asserts no DOM globals exist before or after.
`npm run check:imports` (CI-gated) covers the same contract one layer down,
per source module, and exits `2` rather than green if it cruised too few
modules to mean anything. `yjs` is the only runtime dependency; keep it that
way.

## Install

Published to npm as [`@comfyorg/comfy-multi-player`](https://www.npmjs.com/package/@comfyorg/comfy-multi-player):

```bash
npm install @comfyorg/comfy-multi-player
```

The server pins an **exact** published version. The frontend consumes the
workspace source from the same commit that produces that release. Conflict
resolution is a cross-process agreement about which write wins; two peers
running different versions of these rules can disagree about the outcome.

See
[`docs/decisions/ADR-006-publish-to-npm-pin-exact-versions.md`](docs/decisions/ADR-006-publish-to-npm-pin-exact-versions.md)
for the consumption decision. The earlier git-SHA pinning model
([ADR-004](docs/decisions/ADR-004-consumers-pin-by-sha-no-registry-yet.md),
superseded) remains documented for historical context.

## Develop

```bash
pnpm install
pnpm run build         # tsc → dist/
pnpm test              # vitest: schema, purity, replay, lww, convergence, roundtrip, applier
pnpm run check:purity  # dependency-tree + bare-Node import gate
pnpm run check:imports # module-graph gate: no cycles, src imports yjs only, no Node builtins
pnpm run check:pins    # cross-repo citations are pinned by SHA, not a moving ref
pnpm run verify:corpus # conformance fixtures match their pinned SHAs
pnpm run check:profile-claims # .agents/checks prose still matches the code it restates
pnpm run check:coderabbit     # .coderabbit.yaml still matches the profiles that generate it
```

The canonical source lives at
[`packages/comfy-multi-player`](https://github.com/Comfy-Org/ComfyUI_frontend/tree/main/packages/comfy-multi-player)
in the ComfyUI frontend workspace. Run these commands from that package directory,
or use `pnpm --filter @comfyorg/comfy-multi-player <command>` from the workspace root.

`fixtures/` holds the replay corpus: recorded op sessions with their starting
and final workflows, six conflict-resolution vectors, and the pinned catalog.
Format in [`fixtures/README.md`](fixtures/README.md). Add a fixture with any
change to op semantics.

## Governance

- **The document layout requires frontend sign-off.** Any change to the `Y.Doc`
  layout or to `SCHEMA_VERSION` is reviewed by the frontend team before merge —
  the browser is a co-equal host of this document.
- **Contract changes are amendments**, appended to the schema document with the
  reasoning, never silent edits to a decided section.

## Open contract questions

The writer topology, id allocation, versioning policy, and the catalog pin are
not fully settled. They are written up, with recommendations, in
[`docs/api-contract-proposal.md`](docs/api-contract-proposal.md) — read that
before building against this package.

## License

GPL-3.0-only. See [`LICENSE`](LICENSE).
