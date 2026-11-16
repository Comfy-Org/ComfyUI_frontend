# ADR-ECS-SLOTS-0059: ID-keyed slot membership

Date: 2026-11-16

## Status

Accepted

## Context

Independent runtime identities made slots addressable without positional keys.
Membership still contained records directly, and lookup scanned every attached
node. Moving to ID-keyed ownership must preserve detached construction,
cross-root aliases, and retained extension references without leaking slots
through a global registry.

## Decision

A plain slot component owns ordered input and output IDs and an ID-keyed
record table. Node state owns that component, including while detached. Native
array order and holes remain meaningful because link topology uses indices.
Readers resolve ordered records without cloning metadata or changing indices.

The slot store indexes registered components by record ID. Index entries refer
to the same records, with membership owners rather than duplicated metadata.
Registration rejects distinct records at an occupied identity before publishing
the node. Explicit membership edits update this index synchronously. No reactive
effect reconstructs membership after a mutation.

Duplicate occurrences within one component count as one registered owner.
Removing the final occurrence drops that owner's reference. Removing the final
registered owner removes global lookup, while retained adapters and detached
components can still keep the record alive. Node replacement registers the
replacement's component and unregisters the old component after collision
preflight. Graph teardown unregisters only its own memberships.

Public slot arrays project adapters over ordered IDs. These compatibility views
own neither records nor metadata. Numeric accessor properties and pinned numeric
properties are refused because membership is plain identity data. Non-index
extension properties and native length restrictions remain supported.

This refines the membership-derived scan in ADR-ECS-SLOTS-0058. Runtime IDs still
stay out of workflow serialization. Import and reconstruction mint fresh IDs.

## Alternatives

One strong global map for detached and attached slots would need a new disposal
contract for every extension-held node and slot. A weak map alone could collect
a record while a node still contains its ID. Component-owned tables preserve
the existing reference lifetime without either requirement.

Readonly record-array getters on node state would reduce reader edits, but
object spread would materialize derived arrays during node replacement. Keep
node state plain and resolve records at consumer boundaries instead.

## Consequences

Registered record lookup uses a keyed index rather than scanning graph nodes.
Membership edits reconcile only the edited component. The public mutable-array
API remains a compatibility boundary, so EX-001 remains open for removal of
those projections. ID-keyed component ownership no longer depends on them.
