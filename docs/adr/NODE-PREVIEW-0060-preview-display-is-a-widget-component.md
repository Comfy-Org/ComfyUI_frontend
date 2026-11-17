# ADR-NODE-PREVIEW-0060: Preview display is a widget component

Date: 2026-11-17

## Status

Proposed

## Context

A node's preview region appears only when outputs or live frames arrive. Users
want to size it before the first run, and to switch it off on nodes whose
previews they do not need. The only existing control is
`node.hideOutputImages`, which extensions set and users cannot change.

A user-sized preview height is already durable widget intent under the canonical
preview name (ADR-WIDGET-LAYOUT-0057), and widget components share one lifecycle
and persistence contract (ADR-WIDGET-COMPONENTS-0058).

## Decision

Model the user's choice as a three-state preview display: `auto` shows the
region when content arrives, `shown` reserves it before content arrives, and
`hidden` shows no region even when outputs or live frames arrive, including a
subgraph node's live preview of the work inside it.

Store `shown` and `hidden` as a widget component registered with the shared
lifecycle, keyed by the `WidgetId` of the canonical preview name, or of the
exposure name for a promoted preview. This is the identity the saved preview
height uses, so a reserved zone keeps the height the user drags it to. `auto` is
the absence of a component, so workflows stay sparse and an older frontend
ignores the new property.

`node.hideOutputImages` stays the extension default and applies only while the
user has chosen nothing. Outputs and live frames stay in the node output store;
`hidden` only stops rendering, so switching back shows the latest output at
once. The preview system derives the effective display, and both renderers read
it from there.

## Alternatives considered

- Treating a saved preview height as "show the zone" needs no new state, but it
  cannot express `hidden`, and clearing the height would also discard the size
  the user chose.
- A node property outside the component registry would need its own rename,
  removal, copy, and snapshot rules, which ADR-WIDGET-COMPONENTS-0058 exists to
  prevent.

## Consequences

The node context menu offers the displays the node is not in. Undo, redo, save,
and reload restore the display and the zone height through the shared component
contract, without preview-specific lifecycle hooks.
