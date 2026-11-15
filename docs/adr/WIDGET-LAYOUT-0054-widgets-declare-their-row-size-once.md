# ADR-WIDGET-LAYOUT-0054: Widgets declare sizing, renderers derive row geometry

Date: 2026-11-09

## Status

Proposed

## Context

Canvas and Vue widget rows need the same sizing policy. Capturing a widget's
size requirement during registration creates a second source of truth: the
callback can later return a different result as node dimensions or widget
configuration change. Promoted widgets compound this problem when their hosts
copy the interior widget's sizing metadata.

Size requirements and allocated geometry have different owners. The widget
declares its requirement. Each renderer allocates space within its own body box.
Durable node dimensions remain layout intent, as specified by
[ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md).

## Decision

Read sizing from the live concrete widget when deriving layout. A shared reader
gives `computeSize(width)` precedence over `computeLayoutSize(node)`, matching
the canvas minimum-size contract. The result distinguishes fixed height from
growable minimum and maximum requirements. Registration never evaluates or
stores a sizing result.

Resolve promoted sources through graph topology. Evaluate their callbacks on
the concrete source widget, with its owning node and the destination row's
width. Host values, labels, visibility, and options retain their independent
ownership. Sizing adds no stored source identity or host snapshot to reconcile.

Keep allocation separate from source resolution. The canvas adapter converts
requirements into plain row data for the pure body allocator. Vue derives row
minimums and growth policy from the same reader, then lets CSS allocate space.
Renderer-specific padding and gaps remain local. Existing canvas geometry
fields remain compatibility outputs rather than another sizing authority.

When no live widget exists, Vue uses its existing widget-type defaults. A
declared fixed requirement takes precedence over a type's expanding default.

## Alternatives considered

- **Store requirements at registration and refresh them on change.** Rejected.
  Every callback dependency would require invalidation, and promoted hosts
  would need another synchronization path.
- **Share promoted host state with the interior widget.** Rejected. Hosts own
  independent presentation and value state. Sharing sizing does not justify
  merging those entities.
- **Persist allocated row heights.** Rejected. Allocation depends on available
  space and sibling rows. Storing that result duplicates derived geometry.
- **Use one pixel allocator for both renderers.** Deferred. Vue needs a measured
  body box before it can use the canvas allocator without copying CSS constants.

## Consequences

Changing a live sizing requirement affects subsequent layout reads without
re-registration. Source resolution, requirement evaluation, and allocation are
separate operations, with no sizing cache to keep coherent.

Callbacks may run during reactive layout derivation and must remain read-only.
External changes such as stylesheet loads still need a layout invalidation;
reading live requirements alone does not make external state reactive.

This decision consolidates requirements, not all rendered geometry. Vue DOM
measurement and canvas compatibility geometry remain renderer-specific. It
does not establish or eliminate a measurement feedback loop.
