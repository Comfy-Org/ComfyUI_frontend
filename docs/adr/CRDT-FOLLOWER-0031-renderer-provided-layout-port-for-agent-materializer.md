# ADR-CRDT-FOLLOWER-0031: Renderer-Provided Layout Port for the Agent Materializer

Date: 2026-09-10

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-IDENTIFIER](IDENTIFIER-title.md)] -->

## Context

The in-app agent follower ([CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md))
integrates agent-authored Y.Doc updates into frontend state. Its semantic layer,
`src/core/graph/graphMutations.ts`, materializes nodes and links into the graph
document and never writes position or size into the shared follower Y.Doc. Layout is
renderer state owned by `layoutStore` ([CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)).

Node materialization still needs a layout write: a node the agent creates must get a
`createNode` layout operation with `LayoutSource.AgentRemote`, and a deleted node must
have its layout removed. Two placements were discussed for that write:

1. Let `graphMutations.ts` import `layoutStore` directly and perform the write inline.
2. Keep `graphMutations.ts` renderer-free and have the caller supply the layout write
   through a port.

The follower already took option 2 in shape: `GraphMutationsDeps['layout']` declares a
`SemanticLayoutMutationPort` with `createNode` and `deleteNodes`. What was left
unrecorded was _who constructs the port_. Until now the only implementation was an
inline object literal inside `AgentPanelRoot.vue`, which required the workbench
extension to import `LayoutSource` from the renderer and duplicated layout-operation
construction in a UI component.

A parallel discussion (XC-157, tracked in the program repo) asked whether the
frontend Node-API exception/whitelist policy should also decide this boundary. That
policy governs which litegraph and renderer APIs custom-node extensions may reach; it
does not decide how the agent follower is composed. This ADR records that the
follower keeps its own boundary regardless of the whitelist outcome.

The related refactor [#16908](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16908)
splits the follower layers; it does not move the layout write and is compatible with
this decision.

## Decision

The renderer owns the layout port implementation. The follower core does not import
the renderer.

- `src/renderer/core/layout/agentLayoutPort.ts` exports
  `createAgentLayoutPort(): GraphMutationsDeps['layout']`. It is the only code that
  translates a semantic `createNode` / `deleteNodes` call into `layoutStore`
  operations tagged `LayoutSource.AgentRemote`, carrying the remote actor and opId.
- The port shape stays owned by `src/core/graph/graphMutations.ts`
  (`GraphMutationsDeps['layout']`). The renderer adapts to the semantic contract, not
  the reverse.
- The composition root (`src/workbench/extensions/agent/AgentPanelRoot.vue`) wires
  `layout: createAgentLayoutPort()` into `createGraphMutations`, mirroring the
  mint-port seam in `crdt/mintPortWiring.ts`.
- `src/core/graph/graphMutations.ts` and `src/workbench/extensions/agent/crdt/**`
  (non-test files) must not import `@/renderer/`. The unit test
  `src/workbench/extensions/agent/crdt/rendererBoundary.test.ts` scans those paths
  and fails on any such import.

```text
┌──────────────────────────────┐   Y.Doc update    ┌──────────────────────────────┐
│ agent doc-host (server)      │──────────────────▶│ follower core                │
└──────────────────────────────┘                   │ workbench/extensions/agent/  │
                                                   │   crdt/**                    │
                                                   │ core/graph/graphMutations.ts │
                                                   │   (no @/renderer imports)    │
                                                   └──────────────┬───────────────┘
                                                                  │ GraphMutationsDeps['layout']
                                                                  │ (port shape owned here)
                       composition root                           ▼
┌──────────────────────────────┐  createAgentLayoutPort()  ┌──────────────────────────────┐
│ AgentPanelRoot.vue           │──────────────────────────▶│ renderer/core/layout/        │
│ wires deps into              │                           │   agentLayoutPort.ts         │
│ createGraphMutations()       │                           │ → layoutStore.applyOperation │
└──────────────────────────────┘                           │   source: AgentRemote        │
                                                           └──────────────────────────────┘
```

## Consequences

### Positive

- The op layer stays pure and portable: `graphMutations.ts` can be unit-tested and
  reused (for example in a headless doc-host) without a renderer.
- One place builds agent layout operations, so `LayoutSource.AgentRemote`, actor, and
  opId tagging cannot drift between UI components.
- The boundary is machine-checked, not just documented.
- The whitelist/exception policy for custom nodes (XC-157) can evolve independently.

### Negative

- Any new renderer capability the materializer needs must be added to the port
  interface first, then to the renderer factory. This is two edits instead of one.
- `AgentPanelRoot.vue` still imports the renderer (`layoutStore`, `ACTOR_CONFIG`,
  `createAgentLayoutPort`) under `eslint-disable` for `import-x/no-restricted-paths`.
  That is accepted for the composition root; the guard test covers the layers below it.
- `src/core/**` outside `graphMutations.ts` is not renderer-clean today; the guard is
  deliberately scoped to the follower and does not claim a wider invariant.

## Notes

- Related: [CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md),
  [CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md),
  [GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md),
  [GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md),
  [ECS-0008](ECS-0008-entity-component-system.md), PR [#16908](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16908).
- Glossary:
  - **Follower**: the frontend side of the agent CRDT flow; integrates updates, does
    not author semantic ops.
  - **Materializer**: the follower step that turns semantic Y.Doc nodes/links into
    graph-document state.
  - **Port**: an interface the core declares and the outer layer implements
    (`GraphMutationsDeps['layout']`).
  - **Composition root**: the single place dependencies are constructed and wired
    (`AgentPanelRoot.vue`).
  - **LayoutSource.AgentRemote**: layout-operation tag marking writes originating from
    the agent rather than the local user.
  - **XC-157**: program-repo cross-cutting item on the Node-API exception/whitelist
    policy.
