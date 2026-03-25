# ADR Compliance Audit

Audit the current changes (or a specified PR) for compliance with Architecture Decision Records.

## Step 1: Gather the Diff

- If a PR number is provided, run: `gh pr diff $PR_NUMBER`
- Otherwise, run: `git diff main...HEAD` (or `git diff --cached` for staged changes)

## Step 2: Priority 1 — ECS and Command-Pattern Compliance

Read these documents for context:
```
docs/adr/0003-crdt-based-layout-system.md
docs/adr/0008-entity-component-system.md
docs/architecture/ecs-target-architecture.md
docs/architecture/ecs-migration-plan.md
docs/architecture/appendix-critical-analysis.md
```

### Check A: Command Pattern (ADR 0003)

Every entity state mutation must be a **serializable, idempotent, deterministic command** — replayable, undoable, transmittable over CRDT.

Flag:
1. **Direct spatial mutation** — `node.pos = ...`, `node.size = ...`, `group.pos = ...` outside a store/command
2. **Imperative fire-and-forget APIs** — Functions that mutate entity state as side effects rather than producing serializable command objects. Systems should produce command batches, not execute mutations directly.
3. **Void-returning mutation APIs** — Entity mutations returning `void` instead of `{ status: 'applied' | 'rejected' | 'no-op' }`
4. **Auto-increment IDs** — New entity creation via counters without addressing CRDT collision. Concurrent environments need globally unique identifiers.
5. **Missing transaction semantics** — Multi-entity operations without atomic grouping (e.g., node removal = 10+ deletes with no rollback on failure)

### Check B: ECS Architecture (ADR 0008)

Flag:
1. **God-object growth** — New methods/properties on `LGraphNode`, `LGraphCanvas`, `LGraph`, `Subgraph`
2. **Mixed data/behavior** — Component-like structures with methods or back-references
3. **OOP instance patterns** — New `node.someProperty` or `node.someMethod()` for data that should be a World component
4. **OOP inheritance** — New entity subclasses instead of component composition
5. **Circular entity deps** — New `LGraph` ↔ `Subgraph`, `LGraphNode` ↔ `LGraphCanvas` circular imports
6. **Direct `_version++`** — Mutating private version counter instead of through public API

### Check C: Extension Ecosystem Impact

If any of these patterns are changed, flag and require migration guidance:
- `onConnectionsChange`, `onRemoved`, `onAdded`, `onConfigure` callbacks
- `onConnectInput` / `onConnectOutput` validation hooks
- `onWidgetChanged` handlers
- `node.widgets.find(w => w.name === ...)` access patterns
- `node.serialize` overrides
- `graph._version++` direct mutation

Reference: 40+ custom node repos depend on these (rgthree-comfy, ComfyUI-Impact-Pack, cg-use-everywhere, etc.)

## Step 3: Priority 2 — General ADR Compliance

1. Read `docs/adr/README.md` for the full ADR index
2. For each ADR (except skip list), read the Decision section
3. Check the diff for contradictions
4. Only flag ACTUAL violations in changed code

**Skip list**: ADR 0004 (Rejected — Fork PrimeVue)

## Step 4: Generate Report

```
## ADR Compliance Audit Report

### Summary
- Files audited: N
- Priority 1 findings: N (command-pattern: N, ECS: N, ecosystem: N)
- Priority 2 findings: N

### Priority 1: Command Pattern & ECS
(List each with ADR reference, file, line, description)

### Priority 1: Extension Ecosystem Impact
(List each changed callback/API with affected custom node repos)

### Priority 2: General ADR Compliance
(List each with ADR reference, file, line, description)

### Compliant Patterns
(Note changes that positively align with ADR direction)
```

## Severity

- **Must fix**: Contradicts accepted ADR, or introduces imperative mutation API without command-pattern wrapper, or breaks extension callback without migration path
- **Should discuss**: Contradicts proposed ADR direction — either align or propose ADR amendment
- **Note**: Surfaces open architectural question not yet addressed by ADRs
