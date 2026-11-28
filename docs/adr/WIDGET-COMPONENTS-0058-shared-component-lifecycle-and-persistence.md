# ADR-WIDGET-COMPONENTS-0058: Widget components share lifecycle and persistence

Date: 2026-11-17

## Status

Accepted

## Context

Folder scopes and user-sized heights are durable data attached to widget
identity. Separate implementations of rename, removal, and workflow persistence
produced different ownership rules. Future widget components need to inherit
these rules rather than reproduce them.

## Decision

Keep dedicated, typed component stores keyed by canonical `WidgetId`. Components
are plain data. A shared store primitive owns sparse storage, identity migration,
scoped cleanup, and the translation between runtime components and workflow
metadata. Each durable component supplies its wire key, schema, and encoder.

Register each component store with one widget-component lifecycle system. Widget
and node lifecycle paths invoke that system, never individual component stores.
A shared contract suite exercises every registered component through real node
and widget operations. Adding a registration requires a persistence example for
that suite.

A rename moves components with the widget entity. Explicit widget destruction
removes them. Renderer absence, a temporarily missing widget, and a preview that
has not appeared yet do not destroy the entity. An independently promoted widget
owns its own components even when it shares a source value.

Node removal clears live components after copying them into detached workflow
metadata. Attachment restores them after identity collision resolution. Copies
therefore acquire components under their destination identities. Snapshot restore
replaces previous components, including clearing overrides omitted from the
snapshot's properties. Configuring a node without properties leaves its existing
components unchanged. Invalid saved entries are ignored independently, preserving
valid siblings.

Existing workflow property names and value representations remain compatible.
Extension configure callbacks see the incoming metadata before the frontend
adopts it. These components are not layout operations, derived renderer geometry,
or backend execution options.

## Alternatives considered

- Matching hand-written stores by convention leaves lifecycle drift possible.
- A central entity registry would replace the dedicated-store architecture
  without solving a requirement these components introduce.
- Keeping preferences under a name after rename associates old data with a
  different future widget. Components follow the entity instead.

## Consequences

Component-specific systems retain their own behavior, such as folder filtering
and height allocation. Storage and persistence behavior changes in one shared
implementation. Feature stores do not introduce custom node or widget lifecycle
hooks.
