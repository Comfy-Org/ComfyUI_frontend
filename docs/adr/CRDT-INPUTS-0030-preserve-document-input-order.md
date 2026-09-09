# ADR-CRDT-INPUTS-0030: Preserve Document Input Order During Agent Materialization

Date: 2026-09-09

## Status

Proposed

## Context

The shared agent document addresses connections by numeric input slot. Node
configuration can reorder dynamic inputs, changing what those slots mean (PM-994).
Ordinary loading realigns link endpoints, but an agent workflow must also keep
document and frontend indexes consistent for subsequent remote and local edits.

## Decision

Restore document input order after configuring an agent-created node. Capture
the order before configuration mutates the saved data. Retain configured input
objects and append definition-only inputs, preserving current type/widget metadata.
The shared document and ordinary workflow loading remain unchanged.

## Alternatives considered

- Realign only the local links: fixes initial loading but leaves inbound and
  outbound slot indexes inconsistent.
- Translate slots in both directions: adds a mapping to maintain when document
  ordering already supplies a common set of indexes.
- Change all node configuration: expands the change beyond the agent boundary.

## Consequences

- Existing input indexes agree across initial loading, remote and local connects;
  saving and reopening preserves named targets.
- Synchronizing newly added inputs to the document remains outside this change.
- Configure callbacks run before ordering is restored; their topology guarantees
  are unchanged. Already-saved incorrect connections are not migrated.
