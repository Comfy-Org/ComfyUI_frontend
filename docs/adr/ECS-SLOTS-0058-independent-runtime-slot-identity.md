# ADR-ECS-SLOTS-0058: Independent runtime slot identity

Date: 2026-11-16

## Status

Accepted

## Context

Plain descriptors removed duplicate class-owned metadata, but object identity
alone cannot address a slot from a system. Positional slot keys change when
slots move. A slot adapter can also appear in another node's array without
changing its original owner.

## Decision

Mint a branded UUID for each new slot record, independently of graph, node,
name, direction, or array index. Keep that identity immutable for the record's
lifetime. Existing adapters retain their records, including while detached.

These are runtime identities, not workflow or CRDT identities. Serialization
does not emit them, and reconstruction creates new identities. Importing an
extension's plain slot object also creates a new record rather than adopting
an arbitrary supplied key. Reordering or renaming an existing adapter keeps
its identity. Node-ID reminting does not affect slot identity.

The node-data store resolves identities from its registered plain records.
Lookup follows current membership rather than maintaining another strong
registry. A record stays queryable while any registered node contains it,
including an alias in another root. Removing the last membership removes it
from lookup without invalidating a retained adapter.

Node registration rejects a distinct record at an occupied slot identity
before publishing the node. Re-registering the same raw record or sharing it
between arrays is allowed. Rejection leaves the incumbent unchanged.

Node-ID recovery cannot repair a slot-ID collision. The lifecycle boundary
reports that collision and refuses the node instead of repeatedly minting
node IDs. A caller constructing distinct records must allocate new slot
identities; it must not copy an incumbent key or rekey an exposed record.

## Alternatives

Structural keys would bind retained references to positions rather than slots.
They remain useful locators, but cannot serve as record identity.

A dedicated strong slot registry would need reconciliation and reference
accounting for every array edit, replacement, and cross-root alias. This slice
keeps metadata in the existing registered state and derives identity lookup.
Lookup and collision checks scan registered slots. This trades lookup cost
for one membership lifecycle, without a second metadata authority or stale
registry entries.

Serializing the new keys would change workflow and distributed-merge identity
contracts. That requires a separate decision; runtime addressing does not.

## Consequences

Systems can address a record without resolving a node instance or retaining
an index. Clearing either side of an alias does not reparent the adapter or
discard another registered membership.

Ordered descriptor arrays and compatibility projections remain. This decision
does not complete the final ID-keyed membership and projection-removal steps
of ADR-ECS-SLOTS-0017 or close EX-001.
