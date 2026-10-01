# ADR-CANVAS-DRAG-0038: Keep One Link Gesture per Canvas Connector

Date: 2026-10-01

## Status

Proposed

## Context

Vue slots own separate pointer sessions, but their adapters share the canvas
link connector. The connector rejects overlapping starts without returning an
acceptance result. A rejected slot can therefore acquire UI and reveal state
and later reset another gesture's connector.

## Decision

Reject a slot pointerdown when the shared connector is already connecting,
before assigning its adapter or changing links, pointer sessions, or reveals.
Keep the existing prevention of default handling and event propagation.

Use the connector's existing state rather than adding another ownership flag.
Do not union drag reveals by owner: that would preserve visibility while
leaving conflicting pointer sessions and cleanup active. Returning acceptance
from every connector start is a broader alternative, unnecessary for this
overlapping-start fix.

## Consequences

### Positive

Rejected pointers cannot take over or clean up the active link gesture.
The rule also covers gestures started by canvas and reroute interactions.

### Negative

A second pointer cannot use the slot disconnect shortcut during an active
connection. Idle shortcuts remain available. If an extension vetoes connector
reset, new slot gestures remain blocked until the connector is released;
the guard must not force a reset and override that extension.

## Notes

Regression tests exercise real connector state, DOM pointer listeners, reveal
state, reconnection, and cleanup. Native browser pointer capture is outside the
unit integration test boundary.
