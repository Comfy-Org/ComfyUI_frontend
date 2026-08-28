# In-App Agent CRDT adapter integration boundary

This document is the implementation cross-reference for the integration candidate in PR #16190.
The durable state and distribution decisions are governed by the frontend ADR already present on
this branch, `docs/adr/0020-in-app-agent-crdt-follower-and-distribution.md`, and by the program
ADRs listed below. This candidate must be evaluated as an adapter integration step, not as a new
CRDT authority or a replacement for those decisions.

## Required boundaries

```text
host/doc-host ── update_b64 ──▶ follower Y.Doc ──▶ ECS/domain stores ──▶ render
                                      │
                                      └── never write the shared doc

human canvas ── semantic doc_ops ──▶ host applier
```

- The accepted end shape is the Yjs-backed domain-store seam. Snapshot diffing and
  `LitegraphMutator` are disposable integration material, not a durable state model.
- Layout remains a separate frontend-owned Y.Doc; it is composed with semantic state and does not
  become part of the shared semantic document.
- The shared `@comfyorg/comfy-multi-player` package is the only applier. The frontend does not
  reimplement op-to-document logic.
- Raw Yjs updates flow host to follower only. Human writes go upstream as stamped semantic ops with
  `[base_version, actor, op_id]`; an `op_id` is minted once and never regenerated.
- Ordinary reconnect and sequence-gap recovery retain the follower Y.Doc and use state-vector delta
  replay. Replacement is reserved for an explicit `doc_reset` and must notify consumers first.

## References

- Frontend ADR: `docs/adr/0020-in-app-agent-crdt-follower-and-distribution.md`.
- Workspace ADR-007: [op-based CRDT V1](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-007-op-based-crdt-v1.md).
- Workspace ADR-010: [Yjs-backed FE follower](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-010-fe-follower-yjs-backed-ecs.md).
- Workspace ADR-011: [branch/distribution strategy](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-011-fe-branch-and-distribution-strategy.md).
- Workspace ADR-011: [replay-never-wipe recovery](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-011-seq-gap-recovery-is-replay-never-wipe.md).
- Workspace ADR-016: [incarnation-namespaced stamps](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-016-dq11-incarnation-namespaced-stamps.md).

## Glossary

- **Adapter:** the frontend boundary that applies host-made document updates to frontend state.
- **ECS/domain stores:** the frontend-owned semantic stores that become the render source.
- **State-vector replay:** Yjs catch-up using the follower's existing document state vector.
- **`doc_reset`:** the explicit lineage-break frame that permits document replacement.
