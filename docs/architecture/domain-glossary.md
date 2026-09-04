# Domain Glossary

Canonical vocabulary for the graph domain. Terms are added as they are
resolved during design work; keep entries implementation-free. Intended
to grow into a proper reference document.

Every entry gives a definition and, where the term is routinely confused with
something else, an explicit **not**. If a design discussion needs a word that is
not here, add it here rather than redefining it in the discussion.

Design records that rely on this vocabulary:
[Link Topology Store](link-topology-store.md),
[Reroute Chain Store](reroute-chain-store.md),
[Node Badge Store](node-badge-store.md),
[ADR 0003](../adr/0003-crdt-based-layout-system.md),
[ADR 0008](../adr/0008-entity-component-system.md),
[ADR 0009](../adr/0009-subgraph-promoted-widgets-use-linked-inputs.md),
[Subgraph Boundaries and Widget Promotion](subgraph-boundaries-and-promotion.md).

## Widgets & Values

- **Widget** — the display/edit unit attached to a node input: it shows a valid
  representation of the current Value, and when user interaction changes the
  display it assigns the new value back to the Value. Not a sidebar tab, menu
  item, or badge — those have no Value.
- **Value** — the user-facing datum a Widget displays and writes back. Values
  are persisted with the workflow when the Widget's workflow-serialization
  contract permits it; `widget.serialize: false` excludes them
  (`src/lib/litegraph/src/LGraphNode.ts`). This is distinct from prompt
  serialization (`widget.options.serialize`) and from ephemeral display state
  (focus, hover, an unblurred input buffer), which lives with the Widget
  instance and is never serialized; see
  [Widget Serialization](../WIDGET_SERIALIZATION.md).
- **Widget id** — the string key a Value is stored under,
  `graphId:nodeId:name` (`src/types/widgetId.ts`). A Value is addressed by this
  key, not by an object reference to a widget instance.
- **Widget instance** — one live rendering of a Widget. Several surfaces may
  render the same `WidgetId`-keyed Value at once, but a promoted host Widget and
  its interior source are separate entities with separate `WidgetId`s and store
  entries. The promotion bridge keeps those related Values aligned
  (`src/core/graph/subgraph/promotionUtils.ts`); instance identity is not
  durable and carries no authority over either Value.
- **Schema** — the structural definition a Widget is built from: type, name,
  constraints, default. Sourced from the node definition's `INPUT_TYPES` /
  `InputSpec`. Not the Value, and not the mutable per-instance options.
- **Props** — mutable runtime configuration of a Widget instance (disabled,
  hidden, min/max, callback). Distinct from Schema, which does not change over
  a Widget's lifetime, and from Value, which the user owns.
- **Promotion** — exposing an interior subgraph Widget on the subgraph's host
  node so it can be edited from outside. Promotion creates a host-owned Widget
  and Value, then bridges it explicitly to the interior source; it does not
  move or re-key the interior Widget. Not the same as "convert widget to
  input" ([ADR 0009](../adr/0009-subgraph-promoted-widgets-use-linked-inputs.md)).
- **Promoted widget** — the host-scoped Widget produced by Promotion, owned by
  a linked `SubgraphInput`. Its host Value is authoritative at that boundary;
  the interior Widget supplies schema and metadata but owns a separate Value.
- **DOM widget** — a Widget whose display is a DOM element positioned over the
  canvas rather than drawn on it. A rendering strategy, not a separate kind of
  Value.

## Graph & Subgraphs

- **Node** — an instance of a node type in a graph, carrying inputs, outputs,
  and widgets.
- **Link** — a directed data connection from one node's output slot to
  another node's input slot. At most one live link targets a given input
  slot.
- **Floating link** — a link with exactly one attached endpoint, kept
  alive so a reroute chain survives disconnection. The unattached end is
  unassigned.
- **Reroute** — a visual waypoint that a link's rendered path travels
  through. Purely organisational; never affects data flow. A reroute's
  identity is unique within a workflow, subgraphs included.
- **Reroute chain** — the ordered sequence of reroutes a link passes
  through, from the node output toward the input. Each reroute names its
  upstream neighbour via _parent_; the link names the chain's most
  downstream reroute (the **terminal reroute**).
- **Link membership (of a reroute)** — the set of links whose chains pass
  through that reroute. Membership is _defined by_ the chains: a link is a
  member of exactly the reroutes on the chain walked from its terminal
  reroute upstream. It is never authored independently of the chain.
- **Floating slot marker** — the annotation on the last reroute of a
  floating chain recording which side (input or output) the chain still
  faces.
- **Topology** — which nodes exist and how their slots are connected.
  Moving a node never changes Topology or Values. Value and Topology are
  generally separate, but the current dynamic-widget setter deliberately adds,
  removes, reorders, and relinks inputs when its Value changes
  (`src/core/graph/widgets/dynamicWidgets.ts`), so Value edits are not
  universally topology-neutral on `main`.
- **Subgraph definition** — the reusable graph body: the interior nodes, links,
  and the input/output slots it exposes to a parent graph.
- **Subgraph instance** — a node in a parent graph that stands for a Subgraph
  definition. One definition can have many instances live in the same workflow;
  interior state must never be written as if there were only one.

## Layout & Presentation

- **Layout** — the on-canvas visual state of a workflow: node positions, sizes,
  collapse state, group bounds. Layout never affects execution. Not Topology.
- **Badge** — a small visual annotation rendered on a node: its numeric
  id, lifecycle state, source pack, execution price, or an
  extension-provided marker. Badges are presentation state; they never
  affect execution and are never persisted with the workflow.
- **Badge kind** — the category a badge belongs to: **core** (identity /
  lifecycle / source, projected from the node's definition and user
  settings), **credits** (price of executing an API node, including
  aggregated prices of nodes inside a subgraph), or **extension**
  (provided by third-party code).
- **Badge source** — the domain state a badge's content is computed
  from (settings, node definition, palette, pricing, widget values,
  input connectivity). A badge is always a projection of its sources;
  it is never authored directly by a user.

## Entity, Component, System

Vocabulary from [ADR 0008](../adr/0008-entity-component-system.md), realised as
the dedicated stores shipped in PR 12617. ADR 0008 is **Proposed**: these terms
define the target the codebase is converging on, and existing stores vary in how
closely they meet it.

- **Entity** — a stable id identifying a domain object (node, widget, slot,
  link, reroute, group). Key types follow the concern: `NodeId`, `WidgetId`, and
  graph-scope ids are branded strings, while `LinkId` and `RerouteId` are
  branded numbers (`src/types/{nodeId,widgetId,graphScopeId,linkId,rerouteId}.ts`).
  An Entity is an id, not an object; behaviour never hangs off it.
- **Component** — a plain-data field stored against an Entity id. No methods, no
  back-reference to a parent entity. Not a Vue component. `widgetValueStore`,
  `linkStore`, `rerouteStore`, and `previewExposureStore` hold Component data
  today. `nodeDataStore` still includes slot class instances, while
  `domWidgetStore` and `subgraphNavigationStore` hold live entity objects.
- **System** — logic that reads and mutates Components. Systems are the place
  behaviour lives; they produce command batches rather than firing side effects
  directly.
- **Store** — a concrete state owner keyed by the id type of its concern.
  `nodeDataStore`, `linkStore`, and `rerouteStore` use `NodeId`, `LinkId`, and
  `RerouteId` respectively; `widgetValueStore` uses `WidgetId`, partitioned by
  root-graph UUID. `domWidgetStore` uses widget-instance strings,
  `nodeOutputStore` uses node-locator strings, `subgraphNavigationStore` uses
  graph-id strings, and `previewExposureStore` uses root UUID plus host-locator
  strings (`src/stores/*Store.ts`). `layoutStore` is a Yjs-backed singleton with
  scoped layout keys and concern-specific ids
  (`src/renderer/core/layout/store/layoutStore.ts`). There is no single global
  "World" object; see
  [ECS Pattern Survey](appendix-ecs-pattern-survey.md) for why that design was
  dropped.
- **Command** — a serializable, idempotent, deterministic description of a state
  change. Every entity mutation must be expressible as one, so it can be
  replayed, undone, and transmitted over CRDT
  ([ADR 0003](../adr/0003-crdt-based-layout-system.md)). Not a fire-and-forget
  imperative call.
