# ADR-CANVAS-PLACEMENT-0063: Ghost placement owns its lifetime

Date: 2026-11-26

## Status

Proposed

## Context

Cursor-following placement outlives the pointer gesture that opened node search.
Its document listeners and change notifications therefore need a lifetime
independent of ordinary dragging. Graph-local node IDs cannot identify a pending
node after callbacks switch the canvas to another graph.

## Decision

Represent the lifetime with one consumable finish closure behind the existing
placement interface. Capture the original node and graph, input cancellation,
and owned pan controller. Consume the closure before invoking cleanup callbacks.
Keep the public ghost ID and rendering events as projections rather than cleanup
authority. Setting the public ID alone does not create a placement lifetime;
supported placements begin through the placement interface.

Establish ownership before announcing startup and stop startup if a callback
cancels it. Finish that cancellation after the startup call unwinds: a nested
after-change event can otherwise reach the document-level tracker before the
original before-change event finishes bubbling. Complete placement change
notifications even when the pending node
has disappeared or its removal callback fails. Finish cancellation before an
outgoing workflow is captured; later graph teardown cannot provide that ordering.

Retain shared movement and autopan integration. Releasing the shared pan slot
requires matching its captured controller, and separating all drag modes remains
outside this change.

## Alternatives considered

- A placement record or controller class exposes resource fields without an
  additional consumer. A finish closure provides the required operation directly.
- A listener-only disposer leaves graph identity and transaction completion under
  separate ownership.
- Ordinary dragging ends on pointer release, which would change placement behavior.
- Deferred insertion avoids provisional graph mutations but requires a decision
  about definition-only previews versus initialized nodes, blueprints, and pending
  link connections. It is a separate interaction redesign.

## Consequences

Lifecycle teardown can cancel a placement without reconstructing ownership from
rendering state. Clear and event unbinding reject replacement requests until their
synchronous teardown completes. Normal completion permits callback-driven
replacement placements, which must survive completion of the previous lifetime.
An exception from an after-change callback must not skip the inactive rendering
announcement. This change does not make overlapping ordinary, link, and ghost
dragging independently owned.
