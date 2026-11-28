# ADR-AGENT-SELECTION-0040: Composer Owns Node References

Date: 2026-10-05

## Status

Proposed

## Context

Canvas selection and prompt references have different lifetimes. A reference
can outlive picking, panel closure, or a graph reload. Keeping another copy
in `agentNodeSelectionStore`, keyed by workflow path, required a restore
handshake with canvas selection and broke when a workflow was renamed.

## Decision

Use `agentComposerStore` as the only owner of draft node references. Scope
them by the workflow's session-stable `instanceId`, not its mutable path.
After a graph load, revalidate matching references against the root graph,
including subgraph locators, without restoring canvas selection.

Keep transient picking state in `canvasStore`. The existing injected
interaction-mode reader continues to enforce select-only behavior. Stop
tracking before deselecting so exiting does not erase prompt references.
The banner owns Escape; presentation derives visibility without changing
minimap or sidebar preferences.

This replaces the store ownership specified in
[ADR-CANVAS-INTERACTION-0035](CANVAS-INTERACTION-0035-agent-node-picking-policy.md),
not its input guards. Canvas selection remains owned as specified in
[ADR-CANVAS-SELECTION-0028](CANVAS-SELECTION-0028-single-selection-store.md).

## Alternatives considered

- Repair path-key migration in the old store. This fixes rename but keeps
  two writable copies of draft references and the restore handshake.
- Use canvas selection as the draft. This loses references when selection
  is cleared or the visible graph changes.
- Keep a separate picker store. After removing persistence and preference
  restoration, its remaining state belongs to the existing canvas owner.

## Consequences

### Positive

- Rename and graph reload no longer require a parallel reference cache.
- Closing the panel does not prevent reference revalidation.
- Picking does not write user preferences that later need restoration.

### Negative

- Graph-load integration still needs to know which workflow owns the draft.
- The minimap remains hidden throughout picking, even if its preference is
  toggled; the current preference takes effect when picking ends.
- `instanceId` is a session identity, not a cross-reload persistence key.
