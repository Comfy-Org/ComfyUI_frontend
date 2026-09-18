# ADR-022: Atomic workflow-template insertion

- **Status:** Accepted
- **Date:** 2026-09-11
- **Decider:** Christian
- **Source:** ADR-T8, in-app-agent program TDD (Notion)

## Context

Agents and users need to insert a complete workflow template, including subgraph definitions,
without decomposing it into independently observable graph edits. Existing op shapes deliberately
reject definition-bearing payloads and cannot express that transaction safely.

## Decision

Add the non-batchable `insert_workflow` op. Its frozen envelope carries one authoritative `workflow`
with required top-level nodes and optional links, groups, and definitions. The applier remaps every
carried node, link, group, and nested-definition id to a deterministic string derived from the op
envelope id, graph scope, id kind, and original id. Producers emit the raw workflow unchanged.

Internal node/link references and definition-instance types are rewritten to those derived ids.
Distinct insert ops therefore cannot collide, even when they carry the same raw ids; exact replay
derives the same ids and is a byte-identical no-op through the existing `op_id` gate. The operation
is one Yjs transaction and is stamped as its own register.

## Consequences

- Template insertion is atomic at the semantic-op boundary and deterministic on replay.
- Producers do not inspect document state or remap ids.
- Definition interiors retain scoped graph namespaces, all derived from the op id.
- Existing op schemas remain closed to definitions.

## Invariants

This decision touches KA-1, KA-2, KA-3, KA-4, KA-5, FC-1, FC-3, and FC-4.

## Glossary

- **ADR-T8:** the accepted in-app-agent program technical design for workflow insertion.
- **Canonical projection:** stable, key-sorted JSON used as the definition-content identity.
- **Envelope id:** the immutable `op_id` carried by the semantic operation.
- **Producer:** the cloud or CLI caller that emits the raw workflow payload.
