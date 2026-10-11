# ADR-CANVAS-SELECTION-0031: Ordered Set Storage for Selection

Date: 2026-09-15

## Status

Proposed

## Context

[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md)
requires ordered, graph-scoped session selection with synchronous legacy hooks.
An immutable array reducer copies existing membership for every selected item.
Selecting 200 nodes reconstructs 19,900 existing keys before producing the final
selection. Hooks can read selection between individual additions.

## Decision

Use a reactive native Set in each store bucket. Preserve insertion order and
publish each command synchronously. Return array snapshots to readers.
Selection has no undo history, so retaining prior internal states has no caller.

Reject deferred bulk publication: it changes what synchronous hooks observe.
An immutable collection library would preserve snapshots with cheaper writes,
but selection does not need that dependency or its API.

## Consequences

### Positive

- Add and remove no longer copy existing membership.
- Native Set operations preserve order, uniqueness, and no-op reactivity.

### Negative

- Snapshot reads and ordered replacement still take linear work. A synchronous
  consumer that reads a full snapshot after every addition can still cause
  quadratic work.
- The store owns mutable collections. Callers must use commands rather than
  retain references to those collections.
