# 6. PrimitiveNode Widget Restoration Lifecycle

Date: 2026-02-22

## Status

Accepted

## Context

`PrimitiveNode` creates its widgets dynamically from the connected target's input
configuration. During workflow loading, `LGraphNode.configure()` runs before that
link-derived widget can be materialized. Restoring `widgets_values` only inside
the base configure lifecycle therefore loses the Primitive's serialized value:
the target widget's current value wins when the Primitive widget is created
later.

Widget restoration also supports positional and named serialized values,
including an explicitly present `undefined` value. Implementing a separate
Primitive-only representation would duplicate those semantics and create a
second cleanup protocol.

Copy/paste exposes the same materialization-order constraint. A cloned
Primitive can be configured before it has widgets, so serializing the clone can
omit `widgets_values`. See
[WIDGET_SERIALIZATION.md](../WIDGET_SERIALIZATION.md#primitivenode-and-copypaste)
for the full mechanism.

Related: [#1757](https://github.com/Comfy-Org/ComfyUI_frontend/issues/1757),
[#8938](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8938),
[#16459](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16459), and
[#16800](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16800)

## Decision

Use one generic `WidgetRestorationState` for ordinary and dynamically created
widgets. `createWidgetRestorationState()` normalizes positional and named
serialized values. `LGraphNode.configure()` stores that state in
`widgetValueStore`, lets widgets consume it through `getRestoredWidgetValue()`,
and clears it when configuration finishes.

`PrimitiveNode.configure()` calls the base implementation, then re-stages the
same generic state when the node is graph-owned, has a serialized output type,
and has not materialized its widget. The first complete link-derived widget
build consumes the state through the generic lookup path. A completed build,
type mismatch, or disconnect clears any unconsumed state.

Do not add a Primitive-specific restoration type, store, or scheduler. A general
connectivity-to-widget-materialization system can replace the remaining
lifecycle ordering when the application has an authoritative coordinator for
that phase.

## Consequences

- Ordinary and Primitive widgets share named/positional lookup semantics,
  including presence checks that distinguish a missing value from an explicit
  `undefined`.
- Deferred restoration is keyed by stable graph and node identity in
  `widgetValueStore`; entity instances do not carry a second restoration model.
- Primitive widget materialization remains lifecycle-sensitive. Every path that
  defers restoration must eventually build a compatible widget or clear the
  temporary store entry.
- Copy/paste serialization remains a separate concern because an unmaterialized
  clone may still have no widgets to serialize.

## Alternatives Considered

- Override `PrimitiveNode.serialize()` to preserve configured values during
  copy/paste. This is narrow, but does not solve workflow-load ordering.
- Clone the configured widget instance. Extension-provided widget configuration
  may differ from the target resolved at connection time.
- Make Primitive values a projection of target widgets. Multiple targets make
  the source of truth ambiguous.
- Add a Primitive-only restoration store or System. This duplicates generic
  restoration semantics without providing a general materialization phase.
