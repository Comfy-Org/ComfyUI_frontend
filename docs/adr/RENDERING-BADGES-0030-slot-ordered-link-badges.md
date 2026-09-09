# ADR-RENDERING-BADGES-0030: Slot-Ordered Link Badges

Date: 2026-09-09

## Status

Proposed

## Context

Hidden connections have badges at both ends. Ordering whole links cannot
preserve both nodes' slot order when connections cross. Widget-backed inputs
can also appear in a different order from their indices in the input array.

Hover curves must use the same displaced badge positions as drawing and hit
testing. Culling before collision layout would make badges shift when the
viewport moves.

## Decision

Lay out input and output endpoints independently, grouped by node and side,
then ordered by their displayed socket Y position. Use slot index and link ID
to break ties. Keep the existing deterministic node-ID comparison for collisions
between different nodes.

Compute all hidden badge positions before drawing curves, including offscreen
badges. Drawing, hit testing, and revealed curve endpoints share the resulting
geometry. Only painting is culled by the viewport.

Reject a single link-order comparator because the two ends can require opposite
orders. Reject ordering by slot index alone because widget layout determines
the position users see. Do not persist collision offsets; geometry remains
derived data as specified in
[ECS-LINK-PRESENTATION-0028](ECS-LINK-PRESENTATION-0028-link-presentation-store-ownership.md).

## Consequences

### Positive

- Collision priority follows the local slot arrangement at each endpoint.
- The result does not depend on presentation registration order or viewport.
- Workflow serialization and hover ownership remain unchanged.

### Negative

- Each layout pass sorts twice as many entries as sorting links.
- The existing greedy collision search still has quadratic worst-case cost.
- Different nodes retain ID-based collision priority, so overlapping nodes may
  displace one another's badges regardless of their canvas z-order.
