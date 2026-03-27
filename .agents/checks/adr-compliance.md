---
name: adr-compliance
description: Checks code changes against Architecture Decision Records, with emphasis on ECS (ADR 0008) and command-pattern (ADR 0003) compliance
severity-default: medium
tools: [Read, Grep, glob]
---

Check that code changes are consistent with the project's Architecture Decision Records in `docs/adr/`.

## Priority 1: ECS and Command-Pattern Compliance (ADR 0008 + ADR 0003)

These are the primary architectural guardrails. Every entity/litegraph change must be checked against them.

### Command Pattern (ADR 0003)

All entity state mutations MUST be expressible as **serializable, idempotent, deterministic commands**. This is required for CRDT sync, undo/redo, cross-environment portability, and gateway backends.

Flag:

- **Direct spatial mutation** — `node.pos = ...`, `node.size = ...`, `group.pos = ...` outside of a store or command. All spatial data flows through `layoutStore` commands.
- **Imperative fire-and-forget mutation** — Any new API that mutates entity state as a side effect rather than producing a serializable command object. Systems should produce command batches, not execute mutations directly.
- **Void-returning mutation APIs** — New entity mutation functions that return `void` instead of a result type (`{ status: 'applied' | 'rejected' | 'no-op' }`). Commands need error/rejection semantics.
- **Auto-incrementing IDs in new entity code** — New entity creation using auto-increment counters without acknowledging the CRDT collision problem. Concurrent environments need globally unique, stable identifiers.

### ECS Architecture (ADR 0008)

The graph domain model is migrating to ECS. New code must not make the migration harder.

Flag:

- **God-object growth** — New methods/properties added to `LGraphNode` (~4k lines), `LGraphCanvas` (~9k lines), `LGraph` (~3k lines), or `Subgraph`. Extract to systems, stores, or composables instead.
- **Mixed data and behavior** — New component-like data structures that contain methods or back-references to parent entities. ECS components are plain data objects.
- **New circular entity dependencies** — New circular imports between `LGraph` ↔ `Subgraph`, `LGraphNode` ↔ `LGraphCanvas`, or similar entity classes.
- **Direct `graph._version++`** — Mutating the private version counter directly instead of through a public API. Extensions already depend on this side-channel; it must become a proper API.

### Centralized Registries and ECS-Style Access

All entity data access should move toward centralized query patterns, not instance property access.

Flag:

- **New instance method/property patterns** — Adding `node.someProperty` or `node.someMethod()` for data that should be a component in the World, queried via `world.getComponent(entityId, ComponentType)`.
- **OOP inheritance for entity modeling** — Extending entity classes with new subclasses instead of composing behavior through components and systems.
- **Scattered state** — New entity state stored in multiple locations (class properties, stores, local variables) instead of being consolidated in the World or in a single store.

### Extension Ecosystem Impact

Entity API changes affect 40+ custom node repos. Changes to these patterns require an extension migration path.

Flag when changed without migration guidance:

- `onConnectionsChange`, `onRemoved`, `onAdded`, `onConfigure` callbacks
- `onConnectInput` / `onConnectOutput` validation hooks
- `onWidgetChanged` handlers
- `node.widgets.find(w => w.name === ...)` patterns
- `node.serialize` overrides
- `graph._version++` direct mutation
- `getNodeById` usage patterns

## Priority 2: General ADR Compliance

For all other ADRs, iterate through each file in `docs/adr/` and extract the core lesson. Ensure changed code does not contradict accepted ADRs. Flag contradictions with proposed ADRs as directional guidance.

### How to Apply

1. Read `docs/adr/README.md` to get the full ADR index
2. For each ADR, read the Decision and Consequences sections
3. Check the diff against each ADR's constraints
4. Only flag ACTUAL violations in changed code, not pre-existing patterns

### Skip List

These ADRs can be skipped for most reviews (they cover completed or narrow-scope decisions):

- **ADR 0004** (Rejected — Fork PrimeVue) — only relevant if someone proposes forking PrimeVue again

## How to Check

1. Identify changed files in the entity/litegraph layer: `src/lib/litegraph/`, `src/ecs/`, `src/platform/`, entity-related stores
2. For Priority 1 patterns, use targeted searches:

   ```
   # Direct position mutation
   Grep: pattern="\.pos\s*=" path="src/lib/litegraph"
   Grep: pattern="\.size\s*=" path="src/lib/litegraph"

   # God object growth (new methods)
   Grep: pattern="(class LGraphNode|class LGraphCanvas|class LGraph\b)" path="src/lib/litegraph"

   # Version mutation
   Grep: pattern="_version\+\+" path="src/lib/litegraph"

   # Extension callback changes
   Grep: pattern="on(ConnectionsChange|Removed|Added|Configure|ConnectInput|ConnectOutput|WidgetChanged)" path="src/lib/litegraph"
   ```

3. For Priority 2, read `docs/adr/` files and check for contradictions

## Severity Guidelines

| Issue                                                    | Severity |
| -------------------------------------------------------- | -------- |
| Imperative mutation API without command-pattern wrapper  | high     |
| New god-object method on LGraphNode/LGraphCanvas/LGraph  | high     |
| Breaking extension callback without migration path       | high     |
| New circular entity dependency                           | high     |
| Direct spatial mutation bypassing command pattern        | medium   |
| Mixed data/behavior in component-like structures         | medium   |
| New OOP inheritance pattern for entities                 | medium   |
| Contradicts accepted ADR direction                       | medium   |
| Contradicts proposed ADR direction without justification | low      |

## Rules

- Only flag ACTUAL violations in changed code, not pre-existing patterns
- If a change explicitly acknowledges an ADR tradeoff in comments or PR description, lower severity
- Proposed ADRs carry less weight than accepted ones — flag as directional guidance
- Reference the specific ADR number in every finding
