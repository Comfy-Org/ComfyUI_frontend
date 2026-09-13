# ADR-WIDGET-GROUP-0031: DynamicGroup Widget Lifecycle

Date: 2026-09-11

## Status

Proposed

## Context

DynamicGroup repeats a backend widget template. Its row count is workflow state;
execution consumes individually named fields. A group can sit between ordinary
widgets or inside a DynamicCombo option, so restoration must create its fields
before the following saved values are applied.

## Decision

Use ordinary widgets and their existing store, renderer and prompt serializer
for each field. A hidden, workflow-serialized controller precedes the fields and
recreates rows when its saved count is assigned. It retains that count while a
containing DynamicCombo detaches the widgets to cache their values.

Row headers and the add button are presentation widgets excluded from both
workflow values and execution. The count is also excluded from execution.
Deleting a row renumbers the remaining fields and preserves their values and
connections. API import restores submitted rows in encounter order with contiguous
indices, including rows exceeding `max`. Saving and reloading preserves those
rows. Adding a row remains disabled at or above `max`; execution validity belongs
to backend validation.

Reject a second group-owned value store or a composite widget that renders its
children itself: both would duplicate existing restoration, error, link and
visibility handling. Group fields resolve their original template definitions
so combo refresh and later row creation see the same options.

## Consequences

### Positive

Field widgets retain the common editing, error and persistence behavior without
new node instance properties or a separate workflow format.

### Negative

The controller must precede its fields in serialized widget order. Presentation
widgets require unique names but must never become backend input keys. This
feature covers widget templates; socket-only and nested dynamic templates are
outside the backend contract.
