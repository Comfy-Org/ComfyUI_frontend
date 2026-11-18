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
flex items that share the remaining space with media previews, each up to
its declared maximum. Clearing a height, by
double-clicking its handle, returns the row to that default; a textarea
instead fits its text at the current width, but no fewer than three lines.

A node whose only widget grows has no row height to keep separate from the
node's, so that widget's height is never saved: it always fills the node, and
double-clicking any corner of the node fits that widget.

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
cleanup and graph clearing do this. Demoting a promoted preview clears its
height, because the next preview exposed on that host can reuse the name.
Heights of widgets that are absent when the workflow is saved are kept: a
preview appears only after its node runs, and dynamic widgets are rebuilt
after configure, so absence does not mean the widget is gone. Heights follow the widget entity
through rename and are removed on explicit entity destruction. Shared component
lifecycle and persistence follow
[ADR-WIDGET-COMPONENTS-0058](WIDGET-COMPONENTS-0058-shared-component-lifecycle-and-persistence.md).

Canvas and Vue renderings of the same workflow can differ in row heights
when the user has sized a widget in Vue.

## Extension impact

- A node that has a saved height gets `properties.widgetHeights` when it is
  serialized: an object mapping a widget name, or a promoted preview's host
  exposure name, to a height in pixels. The frontend reads the property once
  the node is in its graph and then deletes it from the live node. During
  `configure`, `onPropertyChanged('widgetHeights', …)` and `onConfigure`
  still see it, because they run first; after that it appears only in
  serialized output. Do not write this property; a value that is not a
  positive number is ignored.
- Every image, animation, and video preview has the source name
  `$$canvas-image-preview`, whichever widget draws it. At load, saved
  `previewExposures` and legacy `proxyWidgets` entries whose source names
  `video-preview` or `$$comfy_animation_preview` are mapped to it. A host's
  exposure names are unique per host, so a second preview promoted to the
  same host is exposed as `$$canvas-image-preview_1`. Find a promoted preview
  by its `sourceNodeId` and `sourcePreviewName`, not by its exposure name.
