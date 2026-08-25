# Domain Glossary

Canonical vocabulary for the graph domain. Terms are added as they are
resolved during design work; keep entries implementation-free. Intended
to grow into a proper reference document.

Design records that rely on this vocabulary:
[Link Topology Store](link-topology-store.md),
[Reroute Chain Store](reroute-chain-store.md),
[Node Badge Store](node-badge-store.md),
[ADR 0008](../adr/0008-entity-component-system.md).

## Badges

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

## Links & Reroutes

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
