# ADR-FAR: Frame-Atomic Rendering

Date: 2026-08-26

## Status

Proposed

## Context

The graph renderer spans two different execution models. Vue and Pinia are
useful for application state, component lifecycle, and scheduling work when an
explicit input changes. LiteGraph canvas drawing is an imperative traversal
that reads a large and evolving graph surface: nodes, slots, links, geometry,
settings, and extension-provided hooks.

Calling a broad imperative operation such as `draw()` from `watchEffect`
silently makes every reactive value read during that operation a dependency of
the effect. The ECS migration exposed this failure mode when slots became
reactive: routine slot-position writes during a foreground draw retriggered an
effect intended only to observe the CanvasInfo setting, causing an unintended
background and foreground pass. The dependency was invisible at the call site
and grew whenever the renderer learned to read another reactive field.

The ECS migration also retains legacy class objects and collection-like values
as compatibility views over store-owned state. These views can synchronize
geometry, derive connectivity, allocate arrays, sort links, or translate a
mutation into store commands. They are necessary at extension boundaries, but
repeatedly deriving them inside a node, slot, or link drawing loop turns a
compatibility cost into a frame-size-dependent cost.

## Decision

Use Vue reactivity to orchestrate renderer work from explicit dependencies;
execute each canvas frame against stable, frame-local read snapshots.

Specifically:

1. Effects that invoke canvas drawing, graph traversal, serialization, layout,
   or another broad imperative operation must declare their reactive sources
   with `watch`, `computed`, or an equivalent explicit selector. They must not
   use the transitive reads of `watchEffect` to discover dependencies.
2. A draw establishes a frame-local view of data whose consistency matters
   across passes. Render order and similar derived collections are computed at
   most once while the graph identity is unchanged and passed through
   foreground, background, connection, and nested same-canvas paths. Graph
   replacement is a pass boundary: if a background callback replaces the
   graph, the foreground pass discards the old context, recomputes visibility
   and render order for the replacement, and renders that graph in the same
   draw. Direct method calls may compute their own local snapshot when no frame
   snapshot is supplied.
3. A frame snapshot is not a cross-frame cache. Persistent caches require an
   explicit invalidation key and proof for graph replacement, membership,
   ordering, subgraphs, and supported extension mutations.
4. Store-native queries and prepared snapshots are the inner-loop rendering
   interface. Legacy mutation views and compatibility collections remain at
   public extension and migration boundaries, but core rendering must not
   repeatedly materialize or synchronize them inside per-node, per-slot, or
   per-link loops.
5. Extension hooks and wrappers continue to receive stable legacy objects where
   compatibility requires them. New renderer APIs should expose immutable or
   purpose-specific read contexts. Wrappers participating in an active draw
   must forward optional frame context arguments for correctness. Discarding
   the context and recomputing after a mid-draw mutation can give passes
   different orders and is not a supported mixed snapshot. A standalone direct
   call may omit the context and compute one local snapshot.
6. A change to these boundaries requires semantic parity tests for ordering,
   graph replacement, hit testing, callbacks, serialization, subgraphs, and the
   supported extension fixture. Performance claims require deterministic work
   counts or complexity slopes before wall-clock benchmarks.

## Alternatives Considered

- **Allow `watchEffect` around rendering and audit dependencies informally.**
  This is concise, but the dependency set is implicit, non-local, and changes
  when any descendant implementation changes.
- **Make renderer-facing ECS state non-reactive.** This would prevent accidental
  tracking, but would discard useful Vue updates and create a second state
  projection that must be synchronized.
- **Cache derived renderer data across frames by default.** This can remove more
  work, but stale graph membership, z-order, subgraph state, or direct extension
  mutation would become correctness bugs. A frame-local snapshot captures most
  duplicate work with a much smaller invalidation contract.
- **Remove compatibility views from extensions immediately.** This gives core a
  cleaner model but breaks the existing extension ecosystem before a supported
  replacement and migration evidence exist.

## Consequences

### Positive

- Reactive dependency edges are visible and reviewable at their call sites.
- Renderer implementation changes cannot silently expand an orchestration
  effect's dependency set.
- Foreground and background passes observe one coherent render order while
  avoiding duplicate graph traversals and sorts.
- Compatibility overhead is contained at boundaries instead of multiplied by
  graph size and draw frequency.
- Deterministic count and parity tests make optimizations easier to review than
  noisy machine-specific timing alone.

### Negative

- Callers must maintain explicit source lists and thread frame context through
  renderer methods and wrappers.
- Mid-frame z-order and other non-identity mutation becomes visible on the next
  draw rather than producing different foreground and background orders in one
  frame. Graph replacement is the exception: it takes effect at the next pass
  boundary in the same draw.
- Third-party wrappers must forward new optional context arguments when called
  as part of an active draw; wrappers that discard them may render incoherent
  pass order until updated.
- Frame-local snapshots allocate or prepare data once per frame; persistent
  caching may still be needed for very large graphs and will require a separate
  invalidation design.
- Compatibility views remain supported and therefore continue to impose some
  maintenance and performance cost at extension boundaries.

## Notes

This decision narrows the renderer implications of
[ADR-ECS](ECS-entity-component-system.md). The motivating regression and
frame-local render-order proof are tracked in
[issue #15977](https://github.com/Comfy-Org/ComfyUI_frontend/issues/15977),
[PR #15980](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15980), and
[PR #15995](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15995).
