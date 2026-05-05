# 9. Subgraph promoted widgets use linked inputs

Date: 2026-05-05

## Status

Proposed

## Context

Subgraph widget promotion historically had two overlapping representations:

1. `properties.proxyWidgets`, a serialized list of source node/widget tuples;
2. linked subgraph inputs, where an interior widget-bearing input is exposed
   through the subgraph boundary.

This created ambiguous ownership. Runtime value reads could collapse to an
interior source widget, while host `widgets_values` could also carry an
exterior value. Multiple host instances of the same subgraph could therefore
stomp one another, and serialization could mutate interior widgets as a
persistence carrier for exterior values.

The ECS widget migration makes that ambiguity more expensive: widgets are
becoming entities with component state keyed by stable entity identity, and
subgraphs are modeled as graph boundary structure rather than a separate
promotion-specific entity kind.

## Decision

Promoted widgets are represented only as standard linked `SubgraphInput`
widgets. A promoted widget is a host-scoped widget entity owned by a subgraph
input on a host `SubgraphNode`. The interior source widget supplies schema,
type, options, tooltip, and default metadata, but it is not the owner of the
host value.

Display-only preview surfacing, such as `$$canvas-image-preview`, is not a
promoted widget. It is a separate preview-exposure system because it has no
host-owned widget value, does not feed prompt serialization, and often points at
virtual `serialize: false` pseudo-widgets that may not exist on the source node.

`properties.proxyWidgets` becomes a legacy load-time input only. Successful
repair consumes entries from `proxyWidgets`; canonical saves do not re-emit
those entries. The standard serialized representation is the existing subgraph
interface/input form plus host-node `widgets_values`.

Display-only preview exposures use their own host-node-scoped serialized entry,
`properties.previewExposures`, instead of `properties.proxyWidgets` and instead
of linked `SubgraphInput` widgets. Canonical preview-exposure JSON uses preview
language, not widget language:

```ts
type PreviewExposure = {
  name: string
  sourceNodeId: string
  sourcePreviewName: string
}
```

Host-node scope preserves current behavior where different instances of the
same subgraph can choose different exposed previews.

The entry intentionally stores only host preview identity and source locator
identity. `name` is the host-scoped stable identity for this preview exposure,
analogous to `SubgraphInput.name`; it is not a display label. It is generated
with existing collision behavior, such as `nextUniqueName(...)`, when an
exposure is created. Media type, display labels, titles, image/video/audio URLs,
and other runtime preview details are derived from the current graph and output
state. Array order is the canonical display order. Preview exposures do not get
a separate persisted `label` in this slice; if a future rename UX needs one, it
should follow the same rule as subgraph inputs: `name` is identity and `label`
is display-only.

Preview exposures are persisted user choices after creation. Packing nodes into
a subgraph may auto-add recommended preview exposures for supported output
nodes, and users may explicitly add or remove additional preview exposures
afterward. Normal load/save does not re-derive previews from node type alone,
because that would make old workflows change when support for new preview node
types is added. Unresolved preview exposures remain persisted and inert;
automatic cleanup does not prune them. They are removed only by explicit user
action or by destruction/unpacking of the owning host.

Preview exposures compose through nested subgraph hosts by chaining immediate
boundaries. If an outer subgraph wants to show a preview exposed by an inner
subgraph host, the outer `previewExposures` entry points at the immediate inner
`SubgraphNode`, and `sourcePreviewName` names the inner host's preview-exposure
identity, not the deepest interior preview name. Runtime preview resolution may
then follow the inner host's own preview exposures to find media. Canonical JSON
does not persist flattened deep paths, because deep paths would couple host UI
state to private nested graph internals.

## Identity and value ownership

- UI/value identity is host-scoped: host node locator plus
  `SubgraphInput.name`.
- `SubgraphInput.name` is the stable internal identity.
- `SubgraphInput.label` / `localized_name` are display-only.
- `SubgraphInput.id` may be used for slot-instance reconciliation, not as the
  persisted widget value key.
- Source node/widget identity remains metadata for diagnostics, missing-model
  lookup, schema projection, and migration only.
- The host/exterior value wins over the interior/source value during repair,
  persistence, and prompt serialization.

This follows the existing widget/slot convention: `name` is identity, `label`
is display.

Promoted-widget value state is a host-scoped sparse overlay over source-widget
metadata and defaults. The source widget remains the schema/default provider;
host value state is materialized only when the exterior value differs from the
effective source default or when restored from persisted host state. Canonical
save/load must not eagerly mirror source defaults or use interior widgets as
persistence carriers.

## Forward ratchet

Loading a workflow with legacy `proxyWidgets` runs a one-way repair:

1. Parse `properties.proxyWidgets` with the existing Zod-inferred tuple type.
2. Invalid raw `proxyWidgets` data logs `console.error`, does not throw, and is
   not quarantined.
3. Build a multi-pass association map before mutation:
   - normalized legacy proxy entry;
   - projected legacy promoted-widget order;
   - host `widgets_values` value, preserving sparse holes;
   - repair strategy or failure reason;
   - whether the entry is a value widget or display-only preview exposure.
4. Defer mutations until node IDs/entity IDs are stable and the subgraph graph
   is configured.
5. On flush, re-resolve against current graph state, because clone/paste/load
   flows may have remapped or created nodes and links.
6. If already represented by a linked `SubgraphInput`, consider the legacy
   entry resolved and consume it.
7. Otherwise repair through existing subgraph input/link systems.
8. If the entry is display-only preview surfacing, ratchet it into the separate
   preview-exposure representation instead of creating a linked `SubgraphInput`.
9. If value-widget repair fails, write inert quarantine metadata and warn.

The repair is idempotent. Pending plans store tuple/value data and re-check the
current graph before applying mutations.

Legacy entries are classified as preview exposures when either:

- the legacy source name starts with `$$`; or
- the source node resolves to a matching pseudo-preview widget, such as a
  `serialize: false` preview/video/audio UI widget.

Everything else is treated as a value-widget promotion candidate. An unresolved
preview-shaped entry remains inert at runtime and is still persisted, because
preview-capable pseudo-widgets and output media can be removed and re-added
dynamically. It is not quarantined because it has no user value to preserve. A
non-`$$` entry that cannot resolve to a source widget is a value-widget repair
failure and follows the quarantine path unless it can resolve to a
pseudo-preview widget.

## Proxy widget error quarantine

Valid legacy entries that cannot be repaired are persisted in
`properties.proxyWidgetErrorQuarantine`. Quarantined entries are inert: they do
not hydrate runtime promoted widgets, do not participate in execution, and are
not used for app-mode/favorites identity.

Quarantine entries preserve enough information to avoid data loss and support
future tooling:

```ts
type ProxyWidgetErrorQuarantineEntry = {
  originalEntry: ProxyWidgetTuple
  reason:
    | 'missingSourceNode'
    | 'missingSourceWidget'
    | 'missingSubgraphInput'
    | 'ambiguousSubgraphInput'
    | 'unlinkedSourceWidget'
    | 'primitiveBypassFailed'
  hostValue?: TWidgetValue
  attemptedAtVersion: 1
}
```

Unresolved legacy UI selections/favorites are dropped with `console.warn`.
Workflow-level promotion/value intent is preserved by
`proxyWidgetErrorQuarantine`, not by a second UI quarantine format.

## Primitive-node repair

Legacy `proxyWidgets` may point at `PrimitiveNode` outputs. Primitive nodes
serve nearly the same purpose as subgraph inputs: they provide a widget value to
one or more target widget inputs. The ratchet repairs this expected legacy
shape in the first migration rather than quarantining it by default.

Primitive repair:

- coalesces exact duplicate legacy entries during planning;
- uses the primitive node's user title as the base input name when the node was
  renamed, otherwise the primitive output widget name;
- applies existing naming behavior and `nextUniqueName(...)` for collisions;
- uses the existing primitive merge/config compatibility logic;
- creates one `SubgraphInput` for the primitive fanout;
- reconnects every former primitive output target to that input in target
  order, using standard connect/disconnect APIs;
- applies the host value when one exists, otherwise seeds from the source
  primitive value;
- leaves the primitive node and its widget value in place, but disconnected and
  inert.

Primitive repair is all-or-quarantine. If any target cannot be validated or
reconnected, the ratchet does not leave a partial rewrite; it quarantines the
entry with `hostValue` and logs the reason.

## Serialization

After repair/quarantine:

- `properties.proxyWidgets` is omitted for repaired entries;
- display-only preview entries are omitted from `properties.proxyWidgets` and
  emitted through `properties.previewExposures`;
- `properties.proxyWidgetErrorQuarantine` carries unrepaired valid entries;
- preview exposures do not carry quarantine values because they do not own user
  values; unresolved preview exposures remain inert in `previewExposures`;
- host `widgets_values` contains host-owned values only for canonical host
  widgets, not source-owned defaults or interior persistence copies;
- quarantined legacy values live in `proxyWidgetErrorQuarantine.hostValue`;
- array-form `widgets_values` remains for now.

Preview exposures are display-only UI metadata. They drive host canvas/app-mode
preview rendering, but they do not create prompt inputs, do not create
`widgets_values`, do not alter node execution order, do not become executable
graph edges, and do not participate in prompt serialization. Runtime mapping
from backend `display_node`/output messages to a host preview exposure is a UI
projection only.

The old `SubgraphNode.serialize()` behavior that copied exterior promoted
values into connected interior widgets is removed. A temporary TODO should mark
that removal point until the ratchet is proven stable. Host values are
serialized through standard subgraph-input widgets instead.

Longer term, `widgets_values` should move from array order to an object/map
keyed by stable widget name, but that migration is out of scope for this
decision.

## App mode, builder, and favorites

The runtime ratchet and UI identity migration ship in the same slice. The UI
must not persist promoted selections by source node/widget identity after this
change.

Canonical UI identity is:

```ts
type PromotedWidgetUiIdentity = {
  hostNodeLocator: string
  subgraphInputName: string
}
```

Legacy source-identity selections are migrated when they resolve through the
ratcheted standard input. Unresolved selections are dropped with a warning.

Preview exposure output selections are also host-scoped and must not persist
interior source node identity. Canonical preview/output identity is:

```ts
type PreviewExposureUiIdentity = {
  hostNodeLocator: string
  previewName: string
}
```

The UI references the explicit preview exposure itself. This keeps subgraphs
opaque: consumers select the host boundary contract, not the interior node that
currently supplies media. Legacy output selections that refer to interior
preview source nodes may migrate if they resolve to a preview-exposure chain;
otherwise they are dropped with `console.warn`. There is no separate preview UI
quarantine.

## PromotionStore

`PromotionStore` becomes vestigial. It may remain temporarily as a derived
runtime compatibility/index layer for existing consumers, but it is not
serialized authority, must not create promotions without linked
`SubgraphInput`s, and should be removed once consumers query the standard graph
interface directly.

## Considered options

### Keep `proxyWidgets` as canonical serialized topology

Rejected. This preserves two representations for the same concept and keeps
source-widget identity in the value-ownership path.

### Preserve bare promoted widgets as degraded runtime state

Rejected. This would avoid some migration complexity, but it perpetuates the
ambiguity that caused host/source value bugs and makes ECS identity less clear.

### Quarantine primitive-node promotions by default

Rejected. Primitive-node proxy promotions are expected legacy workflows, and
quarantining them would break users unnecessarily. They are repaired by bypassing
the primitive node when the repair can be validated all-or-nothing.

### Migrate `widgets_values` to object/map form now

Rejected for this slice. Name-keyed object form is the desired long-term
direction, but combining it with the promotion ratchet increases blast radius
for existing workflow consumers that still assume array order.

## Consequences

- Promoted widget values become host-instance-owned and ECS-compatible.
- Source widgets remain metadata/default providers, not persistence carriers.
- Legacy workflows are repaired toward one standard representation.
- Quarantine preserves unrepaired valid legacy data without reintroducing bare
  runtime promotion.
- Primitive fanout repair is more complex, but avoids breaking common existing
  workflows.
- UI code must migrate with the runtime ratchet to avoid mixed identity states.
- `PromotionStore` has a clear removal path.
