# ADR-ECS-SLOTS-0057: Plain descriptors before independent slot identity

Date: 2026-11-16

## Status

Accepted

## Context

Slot metadata must move out of class instances without breaking detached node
construction or retained extension references. An extension can insert a slot
into another node's array while keeping the same adapter and its original
owner. Array membership therefore cannot define adapter ownership.

[ADR-ECS-SLOTS-0017](ECS-SLOTS-0017-slot-records-as-the-source-of-truth.md)
permits migrating fields before introducing independently keyed slot records.

## Decision

Node shell state owns ordered arrays of plain slot descriptors. Attaching a
node registers those same objects with the node-data store. Metadata writes
through either a descriptor or a compatibility adapter change the same data.

Compatibility arrays project cached adapters from descriptor identity. Weak
caches preserve an adapter's original owner across reordering and transfer
without a strong global registry. Removed adapters retain their descriptors,
so detach, clear, and undo do not invalidate retained references.

Connectivity remains derived from the link store. Drawing methods, node
references, weak widget references, output execution data, and legacy-link
mutation machinery stay outside descriptors. Bounding measurements are exposed
as native typed-array views sharing the adapter's measurement buffer, not as
rectangle class instances or durable layout commands.

Slot arrays must remain extensible and their indexed properties configurable.
Pinning a projected value would violate JavaScript Proxy invariants because
the public adapter differs from its stored descriptor. Such reflection writes
are refused before changing the array. Indexed reads, configurable indexed
writes, iteration, spread, and ordinary array mutations remain supported.

This step does not choose persistent slot keys or close EX-001. The existing
structural slot key still identifies a position, not descriptor identity.
Independent slot records require a later collision and lifecycle decision.

## Alternatives

A dedicated minted-ID store would need detached registrations, alias lifetime
tracking, and collision recovery before metadata ownership could change.
Deferring that machinery lets this migration remove class-owned metadata
without introducing another registration lifecycle.

Index-derived identity would change on reorder and could rebind a retained
adapter to a different slot. Descriptor object identity avoids that failure
without changing workflow serialization.

Parallel descriptor and adapter-owned metadata would require synchronization.
It is rejected because neither representation could be trusted independently.

## Consequences

Renderers can read plain descriptors through node shell state. Extensions keep
stable slot adapters and direct metadata access. Exact class-shaped shell
arrays and non-configurable indexed reflection are no longer supported.

The compatibility arrays and inheritance hierarchy remain temporary. Removing
them and introducing independent slot identity are separate migration steps.
