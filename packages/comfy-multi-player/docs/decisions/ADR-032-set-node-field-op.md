# ADR-032: Field-addressed node metadata writes

- **Status:** Accepted; protocol shape remains provisional until comfy-cli adopts it
- **Date:** 2026-09-21
- **Decider:** Christian Byrne

## Context

Post-creation changes to a node's title, execution mode, collapsed state, and
pinned state have no dedicated CRDT write path. Reusing `add_node` is unsafe:
it replaces the whole node and clears widget stamps, so a metadata change can
clobber an unrelated concurrent widget write.

Two proposals existed: `set_title`, which solved only the reported rename gap,
and `set_node_field`, which gives each supported scalar field its own register.

## Decision

Adopt `set_node_field` with a closed, typed field union:

| Field | Non-null value |
|---|---|
| `title` | string |
| `mode` | non-negative integer |
| `flags.collapsed` | boolean |
| `flags.pinned` | boolean |

`null` deletes the selected field. Each write is LWW-gated on
`("node_field", String(node_id), node_incarnation, field)`. Missing nodes and
stale node incarnations are no-ops. Invalid field/value pairs reject before
mutation. The dedicated `set_title` proposal is superseded.

This is intentionally package-local for now. comfy-cli's pinned vocabulary
does not define either proposal, so the FC-10 exception is explicit and has a
sunset: adopt and pin an upstream amendment, reconciling this shape if needed.

## Consequences

- Independent metadata and widget edits do not contend or replace one another.
- Callers get a discriminated TypeScript union rather than `value: unknown`.
- Wire validators enforce the same field/value relationship at runtime.
- The shared conformance manifest includes all four supported fields.
- `SCHEMA_VERSION` stays 4 because no document root or reserved node key changes.

## Glossary

- **CRDT:** Conflict-free replicated data type; the shared Yjs document here.
- **LWW:** Last-writer-wins ordering by the operation's immutable stamp.
- **FC-10:** The invariant requiring protocol vocabulary references to be pinned to an exact upstream revision.
