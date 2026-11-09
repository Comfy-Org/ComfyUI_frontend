# ADR-WIDGET-LAYOUT-0054: Widgets Declare Their Row Size Once, Both Renderers Read It

Date: 2026-11-09

## Status

Proposed

## Context

A node's height has two authors. The durable one is `node.size`, held by the
layout store and replicated as a `LayoutOperation`
([ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)).
The other is whatever the active renderer measures: litegraph's
`_arrangeWidgets` sums widget heights and calls `setSize` when they overflow,
and the Vue renderer's `ResizeObserver` reports the DOM height back as
`contentSize`, which `renderedSize = max(size, contentSize)` then feeds into
the same CSS `min-height` that produced the DOM height.

Before this decision the two renderers sized widget rows from different
inputs. Litegraph asked each widget for `computeSize()` or
`computeLayoutSize(node)` and distributed the remainder with
`distributeSpace`. The Vue `WidgetGrid` knew only a boolean,
`hasLayoutSize`, and a type allowlist (`EXPANDING_TYPES`), from which it chose
`grid-template-rows: auto` or `min-content` and let CSS decide the pixels. A
widget that asked litegraph for 60px had no way to ask the Vue grid for the
same, so the row's height came from its content and the gap between the two
renderers fed the resize loop that shows up as nodes, subgraph nodes above
all, shrinking or growing on their own.

The question is where a widget's size requirement lives and who may read it.

## Decision

1. **A widget states its size requirement once, as data.** `WidgetLayoutSize`
   (`minHeight`, `maxHeight?`, `minWidth`, `maxWidth?`) is the type of
   `computeLayoutSize` and is stored on the widget's render state in
   `widgetValueStore` at registration, when `deriveWidgetRenderState` runs
   with the owning node. The boolean `hasLayoutSize` is gone; a consumer that
   wants to know whether a widget grows reads the size itself.

2. **Row placement is one pure function.** `layoutNodeBody(box, rows)` in
   `src/lib/litegraph/src/utils/nodeBodyLayout.ts` takes a body box
   (`bodyHeight`, `startY`, `rowGap`) and a list of `RowSpec`s, each either
   `fixed` at a height or `growable` between a minimum and an optional
   maximum, and returns every row's `y` and `height`, the total
   `contentHeight`, and the `freeSpace` left for growable rows. Litegraph's
   `_arrangeWidgets` builds its rows with `widgetRowSpecs` and reads the result;
   it no longer carries its own accumulation loop.

3. **The Vue grid reads the same data and nothing else from litegraph.**
   `WidgetGrid` floors each row at `layoutSize.minHeight` with an inline
   `min-height` and keeps `auto` for rows that declared a size or belong to an
   expanding type. It does not import pixel constants from the litegraph
   module and litegraph does not import Vue padding, gap, or title heights.
   Where the two renderers must agree on a number, the number travels as
   widget data through the store, not as a shared constant.

4. **`node.size` stays the only durable height.** Neither renderer writes a
   measured height into the store as intent. Litegraph still grows a node
   whose rows overflow it when Vue nodes are off, exactly as before; with Vue
   nodes on, the Vue root's `min-height` and the measured `contentSize` remain
   the mechanism, now fed by rows that cannot sit below their declared
   minimum.

## Alternatives considered

- **Persist each widget row's height as durable layout data.** Rejected. A
  row height is a function of the node height, the widget's requirement, and
  its siblings; storing it duplicates a derivation and would need a new
  `LayoutOperation` and migration for a value no user edits directly.
- **Have litegraph mirror the Vue box with shared constants.** Tried and
  removed. Exporting the Vue body padding, row gap, and title height into the
  litegraph layout module made `widget.y` match the DOM, but it tied pixel
  counts across modules in both directions and every Tailwind change to the
  node body would have to be mirrored by hand.
- **Emit `grid-template-rows` in pixels from `layoutNodeBody` for the Vue
  grid.** Deferred. It needs the grid to know its available height, which
  today means reading the node height, title height, slot rows, and footer
  from the DOM or from constants. The minimum-height floor removes the
  shrink-below-requirement case without that coupling; pixel rows can follow
  once the body box is available to the grid as data.
- **Keep `hasLayoutSize` and add a parallel `minHeight` field.** Rejected. Two
  fields that must agree is the pattern this decision removes.

## Consequences

### Positive

- One place states what a widget needs and both renderers honor it; a widget
  author sets `computeLayoutSize` and gets the same floor on canvas and in
  Vue.
- Row placement is testable without a canvas or a DOM, and the litegraph loop
  shrank to reading the function's result.
- No module imports another renderer's pixel constants.

### Negative

- `deriveWidgetRenderState` now needs the owning node, so every registration
  path (`BaseWidget.setNodeId`, `SubgraphNode._setWidget`,
  `AppModeWidgetList`) passes one; a promoted widget's size is computed
  against the interior node it came from.
- `layoutSize` is captured at registration. A widget whose requirement
  changes afterwards (a DOM widget reading `--comfy-widget-min-height` from a
  stylesheet that loads later) keeps the first answer until it re-registers.
- The Vue grid still lets content decide the height of rows above their
  minimum, so the resize loop is narrowed, not closed; closing it is the
  deferred pixel-rows step above.
