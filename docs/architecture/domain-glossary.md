# Domain Glossary

Canonical vocabulary for the graph domain. Terms are added as they are
resolved during design work; keep entries implementation-free. Intended
to grow into a proper reference document.

Design records that rely on this vocabulary:
[Link Topology Store](link-topology-store.md),
[Reroute Chain Store](reroute-chain-store.md),
[ADR 0008](../adr/0008-entity-component-system.md).

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
