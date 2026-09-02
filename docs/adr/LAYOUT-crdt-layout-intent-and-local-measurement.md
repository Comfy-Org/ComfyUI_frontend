# ADR-LAYOUT: CRDT Layout Intent and Local Measurement

Date: 2025-08-27

## Status

Proposed

Implementation status: Partial

## Context

ComfyUI's node graph editor currently suffers from fundamental architectural limitations around spatial data management that prevent us from achieving key product goals.

### Current Architecture Problems

The existing system allows each node to directly mutate its position within LiteGraph's canvas renderer. This creates several critical issues:

1. **Performance Bottlenecks**: UI updates require full graph traversals to detect position changes. Large workflows (100+ nodes) can create bottlenecks during interactions due to this O(n) polling approach.

2. **Position Conflicts**: Multiple systems (LiteGraph canvas, DOMwidgets.ts overlays) currently compete to control node positions. Future Vue widget overlays will compound this maintenance burden.

3. **No Collaboration Foundation**: Direct position mutations make concurrent editing impossible—there's no mechanism to merge conflicting position updates from multiple users.

4. **Renderer Lock-in**: Spatial data is tightly coupled to LiteGraph's canvas implementation, preventing alternative rendering approaches (WebGL, DOM, other libraries, hybrid approaches).

5. **Inefficient Change Detection**: While LiteGraph provides some events, many operations require polling via changeTracker.ts. The current undo/redo system performs expensive diffs on every interaction rather than using reactive push/pull signals, creating performance bottlenecks and blocking efficient animations and viewport culling.

   This represents a fundamental architectural limitation: diff-based systems scale O(n) with graph complexity (traverse entire structure to detect changes), while signal-based reactive systems scale O(1) with actual changes (data mutations automatically notify subscribers). Modern frameworks (Vue 3, Angular signals, SolidJS) have moved to reactive approaches for precisely this performance reason.

### Business Context

- Performance issues emerge with workflow complexity (100+ nodes)
- The AI workflow community increasingly expects collaborative features (similar to Figma, Miro)
- Accessibility requirements will necessitate DOM-based rendering options
- Technical debt compounds with each new spatial feature

This decision builds on [ADR-LITEGRAPH (Merge LiteGraph)](LITEGRAPH-integrate-litegraph-into-the-frontend.md), which enables the architectural restructuring proposed here.

## Decision

We will implement a centralized layout management system using CRDT (Conflict-free Replicated Data Types) with command pattern architecture to separate spatial data from rendering behavior.

### Centralized State Management Foundation

This solution applies proven centralized state management patterns:

- **Centralized Store**: Durable entity geometry (requested position, size,
  bounds, and z-order) is managed in one CRDT-backed store; transient renderer
  measurements remain local projections as clarified by later amendments.
- **Command Interface**: Durable entity-geometry mutations flow through explicit
  operations rather than direct property access. This is not a claim that every
  graph-domain mutation is command-driven.
- **Observer Pattern**: Independent systems (rendering, interaction, layout) subscribe to state changes
- **Domain Separation**: Layout logic completely separated from rendering and UI concerns

This provides single source of truth, predictable state updates, and natural system decoupling—solving our core architectural problems.

### Core Architecture

1. **Centralized Layout Store**: A Yjs CRDT maintains all spatial data in a single authoritative store:

   ```typescript
   // Instead of: node.position = {x, y}
   useLayoutMutations(source).moveNode(rootGraphId, nodeId, { x, y })
   ```

2. **Command Pattern**: All spatial mutations flow through explicit commands:

   ```
   User Input → Commands → Layout Store → Observer Notifications → Renderers
   ```

3. **Observer-Based Systems**: Multiple independent systems subscribe to layout changes:
   - **Rendering Systems**: LiteGraph canvas, WebGL, DOM accessibility renderers
   - **Interaction Systems**: Drag handlers, selection, hover states
   - **Layout Systems**: Auto-layout, alignment, distribution
   - **Animation Systems**: Smooth transitions, physics simulations

4. **Reactive Updates**: Store changes propagate through observers, eliminating polling and enabling efficient system coordination.

### Implementation Strategy

**Phase 1: Parallel System**

- Build CRDT layout store alongside existing system
- Layout store initially mirrors LiteGraph changes via observers
- Gradually migrate user interactions to use command interface
- Maintain full backward compatibility

**Phase 2: Inversion of Control**

- CRDT store becomes single source of truth
- LiteGraph receives position updates via reactive subscriptions
- Enable alternative renderers and advanced features

### Why Centralized State + CRDT?

This combination provides both architectural and technical benefits:

**Centralized State Benefits:**

- **Single Source of Truth**: All layout data managed in one place, eliminating conflicts
- **System Decoupling**: Rendering, interaction, and layout systems operate independently
- **Predictable Updates**: Clear data flow makes debugging and testing easier
- **Extensibility**: Easy to add new layout behaviors without modifying existing systems

**CRDT Benefits:**

- **Conflict Resolution**: Automatic merging eliminates position conflicts between systems
- **Collaboration-Ready**: Built-in support for multi-user editing
- **Eventual Consistency**: Guaranteed convergence to same state across all clients

**Yjs-Specific Benefits:**

- **Event-Driven**: Native observer pattern removes need for polling
- **Selective Updates**: Only changed nodes trigger system updates
- **Fine-Grained Changes**: Efficient delta synchronization

## Consequences

### Positive

- **Eliminates Polling**: Observer pattern removes O(n) graph traversals, improving performance
- **System Modularity**: Independent systems can be developed, tested, and optimized separately
- **Renderer Flexibility**: Easy to add WebGL, DOM accessibility, or hybrid rendering systems
- **Rich Interactions**: Command pattern enables robust undo/redo and macros
- **Collaboration-Ready**: CRDT foundation enables real-time multi-user editing
- **Conflict Resolution**: Eliminates position "snap-back" behavior between competing systems
- **Better Developer Experience**: Clear separation of concerns and predictable data flow patterns

### Negative

- **Learning Curve**: Team must understand CRDT concepts and centralized state management
- **Migration Complexity**: Gradual migration of existing direct property access requires careful coordination
- **Memory Overhead**: Yjs library (~30KB) plus operation history storage
- **CRDT Performance**: CRDTs have computational overhead compared to direct property access
- **Increased Abstraction**: Additional layer between user interactions and visual updates

### Risk Mitigations

- Provide comprehensive migration documentation and examples
- Build compatibility layer for gradual, low-risk migration
- Implement operation history pruning for long-running sessions
- Phase implementation to validate approach before full migration

### Amendment (2026-07-30)

The Yjs operation log is deleted. Nothing ever read it: undo/redo is
snapshot-based through `changeTracker`, and the two query methods
(`getOperationsSince`, `getOperationsByActor`) had no callers outside tests.
It was pure write amplification on every mutation, so the "operation history
storage" memory cost and the history-pruning mitigation above no longer
apply. What is lost is a timestamped, per-actor record: the interaction
history promised above is struck, and the Yjs document runs with the default
`gc: true`, so it is a mergeable state record rather than a replayable one.
Transmission stays a capability of the document rather than of the store:
`applyUpdate` / `getStateAsUpdate` were removed as callerless (see
[Removed CRDT sync seam](../architecture/ecs/ecs-migration-plan.md)) and are a few
lines against `this.ydoc` to reinstate. `LayoutOperation` is the serializable
command shape for persistent node, group, and reroute geometry mutations.
Transient renderer measurements remain outside that command stream. Producers
supply the operation source; the store stamps its session actor at submission.

Entity geometry registers and unregisters with the entity that owns it
(`LGraph.add` / `LGraph.remove`) rather than being seeded per graph on renderer
entry. All three entity types key by `makeScopedLayoutKey(rootGraphId, id)`, so
a root graph's teardown is one `clearGraph`; graphs sharing that bucket drop
their entries individually through `detachGraphLayouts`.

### Amendment (2026-08-04): the replicated document holds intent, not measurement

`NodeLayout.size` conflates two values with different natures. **Requested**
size is what a user, a workflow file, or `computeSize()` asked for. **Rendered**
size is what the DOM produced, which for height is `max(requested, natural
content)` because the node container is `min-h-(--node-height)`. A shared
`ResizeObserver` in `useVueNodeResizeTracking.ts` measures the second and writes
it into the first through `batchUpdateNodeBounds`.

A measurement is not a command. Replayed on a peer with different fonts, locale,
browser, or installed custom-node versions it produces a different — and equally
correct — answer, so it is neither deterministic nor meaningfully undoable. The
command contract applies to durable requested layout, not transient renderer
measurement. Persisting the observer's write would violate that boundary.

Three consequences follow, and they are the reason to act rather than to
document and move on:

- `serialize()` reads `this.size`, which reads through to the store. Saved
  workflows therefore carry a DOM measurement and are not byte-portable across
  machines. Saving while a node is collapsed persists the header box as the
  node's size; on reload `min-h` heals the height and nothing heals the width.
- Under `min-h` semantics with last-writer-wins, a replicated height converges
  to the largest natural height across every connected peer's rendering
  environment. Node geometry becomes a function of who has the document open.
- Collapse is not stored. It is inferred from a box shrinking to its header,
  which is why the store holds rendered rather than requested geometry at all.
  In Vue mode the collapsed width this produces is read by nothing:
  `_collapsed_width` is assigned only in the branch `vueNodesMode` skips
  (`LGraphNode.ts`), so every reader falls through to `NODE_COLLAPSED_WIDTH`.

**Decision.** The Yjs document holds requested geometry, written only by named
commands. Measured geometry belongs to the local, view-scoped tier that
`slotLayouts` already occupies — a plain map, not replicated, dropped by
`clearViewGeometry`. Slot geometry is measured from the DOM at higher frequency
than node height and has never been considered a violation, because it lands in
a tier that nothing replicates and nothing writes back into the DOM. Recording a
measurement stays an explicit, named mutation rather than an ambient observer
write. `LGraphNode.size` exposes requested size; `renderingSize`, `measure()`,
and `boundingRect` expose rendered geometry. Collapse becomes stored data.

**This does not forbid measurement.** Content-driven height is real: widget
hydration, media loading, badges, slot changes, and third-party DOM inserted by
reference through `WidgetDOM.vue`. Making layout strictly one-directional would
mean modelling in TypeScript what CSS already computes, enforced as a height
contract across 40+ repositories we do not control, and paid for in clipped
content in someone else's node. The defect was never that a measurement exists.
It was that a view-derived value was promoted into replicated entity state by a
mutation with no name.

### Amendment (2026-08-23): merge-boundary reconciliation constraint

In-memory registration and collision recovery follow
[ADR 0016](0016-entity-registration-collision-and-recovery-boundaries.md).
The CRDT boundary must reconcile distributed conflicts over stable entity
identity keys before registration. Registries with recyclable structural keys
retain their documented local policies.

**What the CRDT merge boundary must guarantee.** Before any merged entity set
is committed to the in-memory registries, the Yjs merge layer is responsible
for ensuring every entity ID is unique. Concretely:

1. **Layout store.** Yjs's own map-merge semantics (last-writer-wins per key)
   give each `makeScopedLayoutKey(rootGraphId, id)` a single authoritative
   value after merge. No post-merge deduplication is needed for layout; the
   Yjs document itself is the deduplication layer.

2. **Non-layout stores.** Nodes, widgets, links, and reroutes are not yet
   CRDT-replicated. When they are, the applier that materializes semantic ops
   into store registrations must resolve any concurrent `add_node`/`add_link`
   collisions using the op-stamp ordering rule (see
   `decisions/ADR-007-op-based-crdt-v1.md` in the `comfy-multi-player` repo)
   before calling `registerNode`/`registerLink`. The stores must not be
   expected to detect or resolve such conflicts.

**Invariant to carry forward.** Any future Yjs-backed entity store must
satisfy the same guarantee the `layoutStore` already provides: a key in the
Yjs document maps to exactly one canonical value at any point after a merge.
The in-memory registration layer is not a conflict-resolution layer; it is a
commitment layer. Routing a post-merge duplicate ID into a registration call
is a bug in the applier, not a case the store contract covers.

**Why this matters for the Yjs work.** When the graph entity stores are
extended to use Yjs backing, the Yjs merge behavior for each entity kind
(map-merge, array-merge, or op-based) must be chosen so that the
deduplicated view is what the store receives. Choosing raw Yjs structural
updates for entity sets (rather than semantic ops with the LWW gate) would
propagate unresolved duplicates into stores that have no diagnostic path for
them — the confirmed failure mode documented in the `comfy-multi-player`
spike (chapter 7, "the length-8 corruption").

## Notes

This centralized state + CRDT architecture follows patterns from modern collaborative applications:

**Centralized State Management**: Similar to Redux/Vuex patterns in complex web applications, but with CRDT backing for collaboration. This provides predictable state updates while enabling real-time multi-user features.

**CRDT in Collaboration**: Tools like Figma, Linear, and Notion use similar approaches for real-time collaboration, demonstrating the effectiveness of separating authoritative data from presentation logic.

**Future Capabilities**: This foundation enables advanced features that would be difficult with the current architecture:

- Macro recording and workflow automation
- Programmatic layout optimization and constraints
- API-driven workflow construction
- Multiple simultaneous renderers (canvas + accessibility DOM)
- Real-time collaborative editing
- Advanced spatial features (physics, animations, auto-layout)

The architecture provides immediate single-user benefits while creating infrastructure for collaborative and advanced spatial features.

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [CRDTs: The Hard Parts](https://martin.kleppmann.com/2020/07/06/crdt-hard-parts-hydra.html) by Martin Kleppmann
- [Figma's Multiplayer Technology](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
