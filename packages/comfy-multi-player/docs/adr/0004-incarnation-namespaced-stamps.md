# ADR-0004: Namespace widget stamps by node incarnation

**Status:** Accepted  
**Date:** 2026-08-28  
**Decision:** DQ-11, option (c)

## Context

The independent node-presence and widget registers can leave a widget stamp behind when a node is
deleted. Re-adding the same normalized node ID then lets a stamp from the prior node lifetime
compete with a valid write for the new lifetime. The two legal arrival orders of the update/delete
pair produce different post-re-add results.

## Decision

Give every node lifetime an internal `__incarnation` token. Imported and migrated v1 nodes use
`"0"`; a winning modern `add_node` carries the creator's `node_incarnation`, normally its
immutable `op_id`. Node-scoped widget operations carry that token, and widget stamp target keys
include normalized node ID plus incarnation. A non-current-incarnation write is consumed as a
no-op without writing into the current namespace.

The schema is v2. The explicit v1-to-v2 migration assigns `"0"` and updates legacy widget target
keys. Old readers fail closed. The package-level decision does not itself change the WebSocket
envelope version; transport consumers must gate the new field as a compatibility boundary.

```text
old node 7 ── widget stamp(life 1) ── delete
new node 7 ── add(life 2) ── widget write(life 2) ── valid winner
                         ▲
             life-1 stamp cannot contend
```

## Invariants

- `[base_version, actor, op_id]` remains the LWW stamp and `op_id` is never regenerated.
- Equivalent op sets converge independent of arrival order.
- The migration is explicit and schema-versioned; replay copies op payloads rather than deriving
  defaults from a current catalogue.

## Consequences

- Re-adds cannot be defeated by stale widget stamps from an earlier lifetime.
- The persisted document and semantic op shape have a migration boundary.
- Golden vectors, migration tests, both-order convergence tests, and cross-language consumers must
  agree before v2 semantics are exposed.

## Alternatives considered

- Clearing descendant stamps on delete was smaller but did not provide a durable lifetime identity.
- Preserving residue with cross-kind supersession would couple independent presence and widget
  registers.
- Leaving the behavior unchanged is disproved by the DQ-11 minimized counterexample.

## References

- Workspace ADR-016: `decisions/ADR-016-dq11-incarnation-namespaced-stamps.md`.
- `docs/multiplayer-schema.md`, Amendment A16.
- `docs/INVARIANTS.md`, KA-11 amendment.
- `test/incarnation-stamps.test.ts`.

## Glossary

- **Incarnation:** one lifetime of a normalized node ID.
- **Stamp residue:** a widget stamp retained after node deletion.
- **Consumed no-op:** an operation recorded for idempotency that makes no state write.
