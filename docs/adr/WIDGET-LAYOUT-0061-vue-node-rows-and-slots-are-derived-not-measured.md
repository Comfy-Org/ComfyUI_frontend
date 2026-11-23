# ADR-WIDGET-LAYOUT-0061: Vue node rows and slots are derived, not measured

Date: 2026-11-23

## Status

Proposed

## Context

Vue nodes learn where their ports are by reading the DOM. `syncSlotOffsets` reads the node's rectangle and every port's rectangle, converts them to graph-space offsets, and writes a transient snapshot to the layout store. Link endpoints, link hit areas and link-drop targeting read that snapshot. Three owners trigger the measurement: the shared node resize observer, the widget grid's row observer and layout-key watcher, and the `NodeSlots` post-flush watcher.

The DOM is the authority because CSS allocates row heights. [ADR-WIDGET-LAYOUT-0054](WIDGET-LAYOUT-0054-widgets-declare-their-row-size-once.md) gives Vue each widget's declared sizing, but Vue applies it only as a minimum and lets content and `min-content` tracks decide the final height. [ADR-WIDGET-LAYOUT-0057](WIDGET-LAYOUT-0057-user-sized-widget-heights-are-widget-intent.md) stores user-chosen heights as widget components, but they too pass through CSS before they become geometry. Growable regions additionally read the DOM to find their content floor.

Measuring has measured costs. When viewport keep-alive admits a node during zoom, the `NodeSlots` post-flush watcher reads geometry right after Vue patches the new DOM, which forces a synchronous style and layout. Deferring the read until after the browser's own layout removed the forced layout but moved the same work into the frame's render phase. Skipping measurement for reactivated nodes left ports misaligned with link endpoints. Every measurement also needs equality checks, canvas invalidation and a window in which a link draws from a stale or formula offset.

0054 deferred a single allocator for both renderers because Vue had no body box without measuring. The layout store now owns node size, so that reason no longer holds. The canvas already allocates rows with the pure `layoutNodeBody`.

## Decision

Compute each Vue node's body layout from data with a pure system, and render the DOM from that layout. Do not read rendered geometry to learn where rows or ports are.

The system's inputs are:

- the node's body size and collapsed state from the layout store;
- the ordered body items the node renders: the block of slot-only inputs and outputs, then widget rows (socket rows and control rows);
- each control row's declared sizing, read as 0054 specifies;
- user heights from the widget height component (0057), which follows the shared component lifecycle of [ADR-WIDGET-COMPONENTS-0058](WIDGET-COMPONENTS-0058-shared-component-lifecycle-and-persistence.md);
- content heights reported for rows whose height depends on their content (below);
- renderer constants: header height, body padding, row gap, slot row height, the socket-row overlap and the default widget row height.

The system allocates rows with the same `layoutNodeBody` the canvas uses, with the gaps between items expressed as fixed rows, and returns each row's offset and height plus each expanded slot's anchor. A collapsed node needs no allocation: every input anchors at the left edge and every output at the right edge of the collapsed title, half a header height above the body origin.

The result is a transient, per-node derivation keyed by root graph and node ID. It is never persisted and never written by a renderer. Its upstream inputs are not stable: the widget grid's row model and the node's layout object are rebuilt on every frame of a node drag. The derivation therefore keeps its previous value when the new one is structurally equal, so a rebuilt input that changes nothing invalidates neither the canvas nor the rendered rows. Link endpoints read the derivation's slot anchors from a plain map that a watcher publishes, not by reading the reactive value, because they are read about twice per link per frame.

Vue renders rows at the allocated heights. A fixed, user-sized or growable row is a `height` with a `minmax(0, 1fr)` grid track, not a `min-content` minimum, because an `auto` track lets content (for example a textarea's intrinsic height) push the row past its allocation. Renderer constants are defined once in TypeScript and reach the DOM as inline styles or custom properties, so the two cannot disagree silently. The header height is fixed by the same constant rather than left to its content.

A row whose height genuinely depends on its content reports that height. In practice that is:

- a control row with no declared sizing that does not fill the node (core text and combo widgets with a label or upload button, `colors`, `audiorecord`, `imagecrop`, `boundingboxes`, `painter`, `compositor`, `curve`, `imagecompare`, and extension widgets without sizing callbacks);
- the last legacy (canvas-drawn) row when it fills the remaining body and declares nothing.

The report comes from a `ResizeObserver` on that row, which fires after layout and forces none. The height is a row floor, an input to allocation, not a position read. Ports are never measured. A report from a row that is not connected to the document is ignored: when viewport keep-alive detaches a node, the observer reports a zero size for its rows, and accepting it would collapse the rows when the node returns.

Control rows whose widget declares no sizing but always renders at the default widget row height (core number, combo, toggle and slider widgets) are content-measured today only because they declare nothing. Declaring their sizing (0054) turns them into fixed rows and removes their observers; until then the default height is correct before the first report arrives.

Link endpoints and link-drop targeting read slot anchors from the derivation. `syncSlotOffsets`, its three trigger owners and their tests are removed. The layout store's slot-offset snapshot remains only for the subgraph input and output panels, which are not Vue nodes. Mounted node views still own their size measurement as [ADR-CANVAS-0054](CANVAS-0054-mounted-node-views-own-measurements.md) decides; its requirement that slot offsets be restored after history changes no longer applies to Vue nodes, because their anchors are recomputed from the restored data.

## Alternatives considered

- **Keep measuring, but after layout.** Rejected. It removes forced layout but not the layout work, keeps every measurement owner, and still draws one frame from stale offsets.
- **Skip measurement when outer dimensions are unchanged.** Rejected. Port positions can change while the node's size stays the same, and the experiment left visibly misaligned ports.
- **Measure row boxes instead of ports.** Rejected. It still reads layout during admission and keeps the DOM as the authority.
- **Persist allocated row heights.** Still rejected for the reason 0054 gives. The derivation is transient. Only user intent (0057, persisted as 0058 describes) is durable.
- **Report every row's height and derive only the ports.** Rejected. The spike found that most rows (numbers, toggles, sliders, plain combos, sockets, slot blocks) have a height known from constants, and reporting them all would reintroduce an observer per row and a frame of drift on admission.

## Consequences

Link endpoints are correct in the frame in which a node is admitted, without DOM reads, for every row whose height is known from data or whose last report is still valid. The spike measured this on the 245-node workflow with keep-alive: 96 nodes admitted during a zoom, 486 slots, all within 0.001 px of their rendered dots in the first animation frame. On the 500-node chain (`vueNodesLargeGraph`) with keep-alive, removing measurement cut zoom total blocking time from about 4.2 s to 2.9 s and p95 frame time from 50 ms to 33 ms on the same machine; without keep-alive, every node stays mounted, no admission happens, and zoom, pan and drag are unchanged. Keep-alive's remaining zoom cost is mounting and reactivating nodes, which this decision does not address. Admission costs Vue patching and the browser's normal layout. Canvas and Vue rows come from one allocator.

A row that reports content height still uses its declared minimum (or the default widget row height) until the first report arrives, so its ports, and those of every row below it, can move once in the next frame. The first content-sized row is usually low in the node (an image input's combo, a filename field), so few ports are affected, but the window exists.

CSS can no longer stretch a pinned row past its allocation. A layout constant changed in CSS alone would misplace ports. `slotEndpointAlignment.spec.ts` compares the public `getInputPos` and `getOutputPos`, converted to client coordinates, with rendered slot-dot centres for fixed, content-sized, growable, user-sized and collapsed rows, and fails when the TypeScript constants and the rendered layout disagree.

Fitting a node to its content (double-clicking a resize corner) becomes a computation: the derivation's minimum body height plus the header and footer constants. Fitting one widget to its text, or resetting a node whose only widget grows, still needs the text's height and keeps its DOM probe until text widgets report a content height. A declared minimum that understates the widget's real minimum now shows up as a misfit instead of being hidden by `min-content`: core `customtext` declares 50 px but renders 54 px at minimum.

The node's footer tabs overlap the body bottom by a constant that depends on which tab shows; the derivation subtracts it. Any new footer variant must add its overhang there.

This advances [ADR-ECS-0008](ECS-0008-entity-component-system.md): row and slot geometry become a plain-data derivation produced by a system, rather than state written back from the renderer. The spike keeps it as a per-node computed registered for link endpoints; promoting it to a store keyed by `(rootGraphId, nodeId)` is the remaining step and does not change the contract.

## Extension impact

- A widget with `computeSize` gets a Vue row exactly that tall. Content taller than the declared height is clipped or scrolls, rather than growing the row. Declare the real height, or define only `computeLayoutSize` for a row that grows.
- A widget with `computeLayoutSize` gets a growable row within its declared minimum and maximum, as in the canvas renderer.
- A DOM widget with neither callback has its content height reported after first layout, so it keeps growing to fit its content, with one frame in which rows below it draw links from the default height.
- An extension that positions ports itself (`input.pos`, a custom `getInputPos` override) is unaffected for the anchors it supplies; derived anchors cover only ports Vue renders in its slot block and widget rows.
- `getInputPos`, `getOutputPos` and link endpoints keep their contracts. They no longer depend on a node having been measured.
