# ADR-WIDGET-LAYOUT-0057: User-sized widget heights are durable widget intent

Date: 2026-11-15

## Status

Proposed

## Context

Vue nodes let users resize each growable widget row and each media preview
independently. A template or shared workflow must reopen at the author's
sizes, so a dragged height has to survive serialization.

[ADR-WIDGET-LAYOUT-0054](WIDGET-LAYOUT-0054-widgets-declare-their-row-size-once.md)
rejects persisting allocated row heights, because allocation depends on
available space and sibling rows. A user's drag is different: it states what
the user wants for one widget, not what the allocator produced.

## Decision

Store a dragged height as a component of the widget it sizes, in a dedicated
store keyed by `WidgetId`. Previews use their canonical media preview name, so
a node's own preview and a preview promoted to a subgraph node each have one
key.

Persist only heights the user set. Nodes adopt saved heights from their
`widgetHeights` property when configured or attached, and serialization writes
the store's entries back to that property. Rows without a saved height remain
CSS auto tracks that share the remaining space. Clearing a height, by
double-clicking its handle, returns the row to that default.

Saved heights are Vue renderer intent. The canvas renderer ignores them and
keeps allocating rows from declared sizing alone. A height changes the node's
size through the existing node resize path, so node dimensions keep flowing
through layout operations; the widget height itself is not a
`LayoutOperation`.

## Alternatives considered

- **Keep heights in `node.properties.widgetHeights` at runtime.** Rejected.
  Properties are untyped node instance state, and promoted previews would need
  their host node to mirror interior keys. The property remains the wire form
  only.
- **Persist heights computed by a JavaScript fill pass.** Rejected for the
  reason ADR-WIDGET-LAYOUT-0054 gives: allocated geometry is derived.
- **Route widget heights through `LayoutOperation`.** Deferred. Layout
  commands cover node, group, and reroute geometry. Widget heights can join
  them when collaborative editing needs per-widget intent.

## Consequences

Workflows saved from Vue nodes carry a `widgetHeights` property on nodes the
user resized. Older frontends keep it as an opaque property.

Removing a node or graph must clear its store entries; node-owned store
cleanup and graph clearing do this.

Canvas and Vue renderings of the same workflow can differ in row heights
when the user has sized a widget in Vue.

## Extension impact

- A node that has a saved height gets `properties.widgetHeights` when it is
  serialized: an object mapping each widget or preview name to a height in
  pixels. On configure and on attach, the frontend reads the property and then
  deletes it from the live node, so extensions see it only in serialized
  output. Do not write this property; a value that is not a positive number is
  ignored.
- Every image, animation, and video preview is exposed and promoted under the
  name `$$canvas-image-preview`, whichever widget draws it. At load, saved
  `previewExposures` and legacy `proxyWidgets` entries naming `video-preview`
  or `$$comfy_animation_preview` are mapped to it. Extensions that look up a
  promoted preview by name should use `$$canvas-image-preview`.
