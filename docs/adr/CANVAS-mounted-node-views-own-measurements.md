# ADR-CANVAS-mounted-node-views-own-measurements: Mounted node views own measurements

Date: 2026-11-19

## Status

Accepted

## Context

The graph's requested size is durable. A rendered node can be larger because of content and CSS constraints. Undo and redo reconstruct graph records even when Vue can keep the same elements. Invalidating measurements on every reconstructed layout record made the observer report dimensions that had not changed.

## Decision

For ordinary Vue nodes, retain measurements for the lifetime of the mounted view, scoped to its graph and node. History restoration can reuse a measurement if the view survives; deleting a node or replacing a workflow retires it, even when the replacement reuses an ID. Expanded bounds use the larger of the requested and measured dimensions. A measurement from the expanded view does not substitute for a collapsed measurement.

The layout store still owns requested geometry and slot offsets. Slot offsets must be restored after history changes even when a size measurement is unchanged. Canvas-rendered nodes and subgraph I/O keep their existing sizing paths.

## Alternatives

Batching re-observation on layout creation reduces scheduling overhead but still ties DOM measurements to graph record churn. Retaining measurements by durable ID alone avoids re-observation on undo but can leak stale bounds into a different workflow or replacement node. Writing measurements back as requested size would serialize local CSS constraints and prevent a node from shrinking when its content shrinks.
