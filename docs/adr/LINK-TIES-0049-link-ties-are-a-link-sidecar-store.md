# ADR-LINK-TIES-0049: Link Ties Are a Link Sidecar Store

Date: 2026-10-26

## Status

Proposed

## Context

Issue #21961 asks for link ties: the user strokes a line across several links,
and the links are pulled through a small tie and run side by side as a ribbon.
A tie has a position, an angle, and an ordered list of the links it holds. The
order matters: it is the side-by-side order of the strands, and keeping it
stable is what stops a ribbon from crossing inside itself.

A third-party extension implements this by wrapping
`LGraphCanvas.renderLink` and `drawConnections`, storing ties in
`graph.extra.zipTies`, and claiming the gesture with capture-phase `window`
listeners. Because `graph.extra` is opaque to the graph, ties are lost on copy
and paste and on subgraph conversion, and link ids they reference go stale when
a graph is normalized.

Ties look like reroutes, but they are not reroutes. A reroute is one point
shared by every link that passes through it; a tie gives each link its own
strand point, offset sideways by the link's place in the ribbon. Links reach a
reroute through `parentId` chains; a link passes through any number of ties
with no chain at all.

## Decision

1. `linkTieStore` owns ties, partitioned by root graph and owning graph
   (`GraphScope`), the same partitioning as
   [ADR-ECS-LINK-PRESENTATION-0028](ECS-LINK-PRESENTATION-0028-link-presentation-store-ownership.md).
   A tie is plain data: `{ id: LinkTieId, pos, angle, linkIds }`. Tie ids are
   branded and unique within their owning graph. Each mutation also rebuilds an
   index from link id to ties, so a draw pass resolves the graph's ties once
   and an untied link costs one map lookup. Behaviour lives in pure functions
   (`linkTieGeometry.ts`) and a small canvas adapter (`linkTieInteraction.ts`).
   No entity class gains a field or a method.

2. The wire format is `extra.linkTies: { id, pos, angle, linkIds }[]` on the
   root graph and on each subgraph definition, in both schema 0.4 and
   schema 1. `asSerialisable` adds it from the store; configure loads it once
   links exist and removes it from `extra`. Workflows without ties serialize as
   before. `zExtra` is passthrough, so older frontends load these workflows,
   ignore the ties, and keep the field when they save.

3. Ties follow link topology:
   - Every boundary that removes link topology releases the link's sidecars
     (presentation and tie membership) together: link unregistration, link
     replacement, and the atomic removal in input slot realignment. A
     registration that lost a collision removes nothing.
   - Loading drops link ids that do not exist.
   - `remapLinkReferences` remaps `extra.linkTies` with every other link
     reference, so reminted link ids keep their ties.
   - Copy serializes the ties restricted to the copied links; paste maps them
     through the paste's link id map and offsets them with the pasted items.
   - Converting to a subgraph moves the part of each tie that holds interior
     links into the new definition and remaps boundary links to the parent
     links that replace them. Unpacking maps the definition's ties through the
     unpack link id map, offsets them with the unpacked nodes, and maps parent
     ties on the wrapper's links to the links that replace them.

4. Rendering stays in the canvas link pass. A link without reroutes is split
   into one segment per tie it passes through; tie ends use `CENTER`
   directions and control points along the tie, as reroute segments do.
   Culling uses the segment ends and tie control points, so a ribbon stays
   drawn while its tie is on screen. After the segments draw, the link gets one
   `Path2D` and one polyline for the whole route, so pointer hit testing,
   marquee selection, and the tie stroke see the whole drawn link. Ties are
   neither drawn nor hit-tested while links are hidden.

5. The gesture is a held key plus a drag. Holding Z arms the canvas: the canvas
   tracks the key in `processKey` the way it tracks Space panning, and
   `GraphCanvas.vue` forwards Z from focused Vue nodes, skipping editable
   controls. Window blur, a visibility change, and unbinding the canvas disarm
   it. A primary press with no other modifier claims `CanvasPointer` callbacks
   before target resolution; in Vue nodes mode the press is forwarded to the
   canvas before a node can start its own drag. Ties are a pointer target
   ahead of links: a drag past the click threshold moves a tie, a
   double-click removes it, and a stroke that crosses a tie cuts it instead of
   creating one. Moves follow `CanvasPointer` drag classification, as
   [ADR-CANVAS-GESTURE-0029](CANVAS-GESTURE-0029-pointer-gesture-state-machine.md)
   requires.

## Alternatives considered

- **Ties in `graph.extra` as opaque data.** Smallest change, but copy, paste,
  subgraph conversion and id remints never see it. Rejected.
- **Ties as reroutes.** A reroute cannot give each link its own strand point,
  and every link through a reroute shares its chain. Rejected.
- **Tie geometry as `LayoutOperation`s in the layout store.**
  [ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
  limits the command stream to node, group, and reroute geometry and asks not
  to generalize it. Ties are a presentation sidecar of links, like hidden-link
  badges, and are not selectable `Positionable`s yet. Rejected for now; it
  becomes the right home if ties join selection or collaborative editing.
- **A keybinding command.** The keybinding service runs commands on keydown
  only and has no key-up phase, so it cannot express hold-and-drag. Space
  panning has the same need and is handled in `processKey`; ties follow it.
- **Capture-phase `window` listeners.** They pre-empt every canvas gesture and
  duplicate hit testing. Rejected in favour of `CanvasPointer` callbacks.

## Consequences

- Ties survive save, load, undo, copy and paste, and converting to and
  unpacking a subgraph. Undo needs no new code: change tracking snapshots the
  serialized graph.
- Links that pass through reroutes cannot be tied.
- A link reconnected between the same two slots gets a new id and leaves its
  ties.
- Moving the nodes at both ends of a tie does not move the tie, because ties
  are not part of the selection.
- Rotation, colours, and a tie menu are not part of this decision.
- Every new path that recreates or removes links must carry or release ties
  explicitly, as it must for presentation.
