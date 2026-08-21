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
// { applied: [...], skipped: [], failed: null, applied_count: 1, version: 1 }

const workflow = project(doc, catalog); // ComfyUI workflow JSON, ready to render
```

Every replica of a document forks from **one** minted snapshot:

```ts
const follower = new Y.Doc();
Y.applyUpdate(follower, Y.encodeStateAsUpdate(hostDoc));
```

Do not call `mint()` twice on the same workflow to produce two replicas. Two
independent mints create Yjs structures with different internal identities, and
their contents **double** on the first merge. Each side looks correct alone, so
this is silent until the merge.

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

### `applyOps(doc, ops, catalog?): ApplyResult`

Applies a batch, one Yjs transaction per op, in the given order. Never throws
for a rejected op — every outcome comes back in the result. See
[outcomes](#what-applyops-returns) below.

`catalog` is optional but effectively required for a real host: without it, an
`add_node` carrying positional widget values is rejected `catalog_required`,
and unknown widget names are no longer caught.

### `project(doc, catalog): WorkflowJSON`

Pure read, byte-stable for a given document state, so the browser and the
server render identical JSON. Canonicalization: nodes and links sorted by id;
the name-keyed widget map assembled into positional `widgets_values` (missing
names project as `null`); `outputs[].links: null` preserved verbatim, never
coerced to `[]`; every unrecognized workflow key passed through untouched.

Throws (`TypeError`) if a node has widget values whose class the catalog does
not describe — see [`opaque_widgets`](#opaque-widgets) for the case that is
handled instead of throwing.

### `migrate(doc, fromVersion): void`

Document-layout versioning. `SCHEMA_VERSION` is `1`, so today this validates
and no-ops at v1 and throws `SchemaVersionError` for anything else — including,
deliberately, a document newer than the code. A host never best-effort reads a
layout it does not know.

### Stamp machinery

`stampKey(op)`, `compareStampKeys(a, b)`, `writeTarget(op)`,
`stampTargetKey(op)`, `codePointCompare(a, b)`. You need these only if you are
building conflict UI or your own bookkeeping — `applyOps` uses them internally.

### Layout helpers

`initDoc`, `nodesMap`, `linksMap`, `definitionsMap`, `metaMap`, `appliedMap`,
`stampsMap`, `createNodeMap`, `resolveDefinition`, `countDefinitionInstances`,
`OPAQUE_WIDGETS_KEY`, `isOpaqueWidgets`, `WIDGET_STORAGE_STRATEGIES`,
`widgetStorageFor`, `widgetStorageOf`. Reading the document directly is
supported; writing to it outside `applyOps` is not.

A node's widget values are stored one of two ways — `named` (the name-keyed
`widgets` map) or `opaque` (the whole `widgets_values` array verbatim, for a
class the pinned catalog cannot describe). `widgetStorageFor(widgets_values,
widget_order)` answers which one a payload needs before it is written;
`widgetStorageOf(node)` answers which one a node already in the doc is using.
Switch on the returned `WidgetStorage` rather than sniffing keys, so adding a
third strategy is a compile error in your code too.

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
| `connect` | `link_id`, `from_node`, `from_slot`, `to_node`, `to_slot` (`null` for autogrow), `link_type`, optional `grow` | yes |
| `set_widget` | `node_id`, `widget` (name, never index), `value`, optional `old`; interior writes add `path` + `inner_widget` | yes |
| `delete_node` | `node_id`, `removed_links` | yes |
| `clear` | `removed_nodes` | no |
| `reset_doc` | see [open questions](docs/api-contract-proposal.md) — currently rejected `op_deferred` by this package | no |

`FROZEN_OPS`, `DEFERRED_OPS`, and `BATCHABLE_OPS` are exported so you can check
programmatically rather than hard-coding the lists, along with the matching
`OpKind` / `FrozenOpKind` / `DeferredOpKind` / `BatchableOpKind` types. A
compile-time assertion in `src/types.ts` pins that `FROZEN_OPS ∪ DEFERRED_OPS`
is exactly `Op["op"]` and that `BATCHABLE_OPS ⊆ FROZEN_OPS`, so the lists and
the union cannot drift apart silently.

An op kind this build does not know — one minted by a peer built against a
newer vocabulary — is **rejected loudly**, never silently dropped: `applyOps`
returns `failed.code === "unknown_op"`, applies nothing, and aborts the
remainder of the batch (the doc is byte-identical afterwards).

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
  applied: string[];        // op_ids consumed by this call, in apply order
  skipped: string[];        // op_ids already applied to this document before the call
  failed: { index, op, code, message } | null;
  applied_count: number;    // applied.length
  version: number;          // total ops this document has ever consumed
}
```

Five outcomes, and the distinction between them is the part integrators get
wrong:

| Outcome | Reported in | Document changed | `op_id` consumed |
|---|---|---|---|
| Applied | `applied` | yes | yes |
| **Dropped by last-writer-wins** — a higher stamp already owns that target | `applied` | no | yes |
| **Delete-wins no-op** — the target node is gone | `applied` | no | yes |
| Duplicate — already applied to this document | `skipped` | no | already was |
| Rejected | `failed` | no (byte-identical) | **no** |

`applied` means "this document is done with that op_id", not "your value won".
A client that renders optimistically must clear a pending op when its effect
arrives on the update stream, not when the ack lists it as applied.

**Batches abort the remainder.** If op *k* fails, ops 0..*k*-1 stay applied and
ops *k*..*n* are not applied at all. Fix the failing op and resend the whole
batch with the **same** `op_id`s: the prefix comes back in `skipped`, the
remainder applies. Rejected ops consume nothing, so a batch is always
retryable.

Rejection codes: `malformed_op`, `unknown_op`, `op_deferred`,
`catalog_required`, `invalid_node_payload`, `unknown_widget`, `opaque_widgets`,
`widget_out_of_range`, `input_slot_missing`, `output_slot_missing`,
`not_a_subgraph`, `interior_node_not_found`, `shared_definition_unforked`, and
`apply_failed` for anything unexpected. Match on `code`, never on `message`.

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
  is gone is a no-op, not an error.
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

The package is not published to a registry yet. Pin it by commit SHA:

```bash
npm install github:Comfy-Org/comfy-multi-player#<sha>
```

Both the frontend and the server must pin the **same** SHA. Conflict resolution
is a cross-process agreement about which write wins; two peers running
different versions of these rules can disagree about the outcome.

A git dependency runs this package's `prepare` build to produce `dist/` on
install, so both the types and the runtime resolve from the pinned SHA. Package
managers that gate install-time build scripts must allow it explicitly — for
pnpm, add an `allowBuilds` entry in the consumer's `pnpm-workspace.yaml` keyed by
the fully-resolved git spec. See
[`docs/decisions/ADR-004-consumers-pin-by-sha-no-registry-yet.md`](docs/decisions/ADR-004-consumers-pin-by-sha-no-registry-yet.md)
for the consumption decision and the future registry-publish option.

## Develop

```bash
npm install
npm run build         # tsc → dist/
npm test              # vitest: schema, purity, replay, lww, convergence, roundtrip, applier
npm run check:purity  # dependency-tree + bare-Node import gate
npm run check:imports # module-graph gate: no cycles, src imports yjs only, no Node builtins
```

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
