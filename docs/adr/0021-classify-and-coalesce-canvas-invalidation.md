# 21. Classify and Coalesce Canvas Invalidation

Date: 2026-08-26

## Status

Proposed

## Context

`LGraphCanvas` has separate foreground and background dirty flags. Foreground
work draws nodes, widgets, overlays, and transient execution state. Background
work draws connections and other topology or geometry-dependent content. A
background draw currently makes the foreground dirty as part of its legacy
composition behavior, so requesting too broad a layer can multiply work.

Invalidation requests currently arrive from graph mutations, progress events,
settings, layout synchronization, pointer interaction, animation, Vue
components, and extension hooks. Most call sites express only booleans, which
cannot answer why a frame was requested, whether several requests describe the
same change, or whether repeated state writes changed rendered output.

The execution-performance investigation found both failure patterns. An
implicit reactive edge generated unintended background passes, while repeated
progress updates scanned nodes, wrote equal values, and requested redraws even
when no rendered ratio changed. Conversely, extensions depend on prompt
redraws and may wrap or call existing `setDirty` methods, so removing or
deferring invalidations without a compatibility contract risks stale visuals.

## Decision

Treat canvas invalidation as a classified, frame-coalesced request with
preserved foreground/background and animation semantics.

Specifically:

1. Every new core invalidation site must choose the narrowest affected layer:
   foreground for node-local visual or transient state; background when
   connections, topology, canvas background, or geometry used by background
   rendering changed; both only when both outputs can differ.
2. Core invalidation requests carry a stable reason category in development
   instrumentation. Initial categories should distinguish execution/progress,
   topology, geometry/layout, settings/theme, interaction/selection,
   animation, graph replacement, and extension/unknown. Reasons are diagnostic
   metadata, not a public behavioral API until separately stabilized.
3. Idempotent state application precedes invalidation. If an update does not
   change rendered output, it performs no renderer write and requests no draw.
   Batched updates request each required layer once after all effective changes
   have been applied.
4. Requests before the next animation frame are unioned by canvas and layer.
   Reason counts remain observable, but redundant requests do not cause
   additional draws. Foreground and background dirty flags remain set until
   their corresponding work is presented.
5. Continuous animation is explicit. An animation owner requests subsequent
   frames while active and stops on completion, disposal, hidden/frozen state,
   or reduced-motion substitution. Event-driven state updates do not create an
   implicit perpetual render loop.
6. The legacy `setDirty(foreground, background?)` surface remains supported for
   extensions and is classified as extension/unknown when no core reason is
   supplied. Wrappers must preserve both boolean arguments and return/lifecycle
   behavior. New extension APIs should offer a named invalidation method rather
   than exposing scheduler internals.
7. An invalidation optimization must prove visual and lifecycle parity before
   timing: foreground/background draw counts, final pixels or rendered state,
   graph and subgraph replacement, add/remove during updates, duplicate legacy
   identities, extension wrappers, disposal, and animation endpoints. It must
   then demonstrate the eliminated writes, traversals, dirty requests, or
   complexity slope under representative graph sizes.

## Alternatives Considered

- **Keep boolean dirty flags without reasons.** This preserves the smallest API,
  but leaves regressions unattributable and encourages broad `true, true`
  invalidations.
- **Redraw both layers for every change.** This is simple and robust for
  correctness, but scales poorly with graph and link complexity and hides layer
  ownership mistakes.
- **Draw immediately at each mutation site.** This lowers latency for an
  isolated update, but duplicates work during bursts and makes partially
  updated state observable.
- **Debounce updates with a fixed timer.** This reduces work but adds latency,
  is disconnected from presentation cadence, and can reorder lifecycle events.
- **Replace `setDirty` and require extensions to migrate immediately.** This
  would provide a clean scheduler contract but would break wrappers and custom
  nodes that depend on the established surface.

## Consequences

### Positive

- Redraw work is bounded to at most the required layer passes per presented
  frame, even when many sources invalidate together.
- Equal progress or state messages become cheap no-ops instead of graph-wide
  redraw triggers.
- Reason counters identify which subsystem consumed a frame budget without
  requiring a full browser trace.
- Explicit animation ownership prevents accidental steady-state loops and
  provides clear cleanup and reduced-motion behavior.
- The compatibility path remains functional while new code gains a narrower,
  diagnosable API.

### Negative

- Reason propagation and development counters add implementation surface and
  require consistent taxonomy maintenance.
- Frame coalescing can defer a change until the next animation frame; code that
  incorrectly relied on synchronous drawing must be identified.
- The foreground-after-background legacy behavior means layer semantics cannot
  become perfectly independent without a later rendering-composition change.
- Extension-origin requests may remain unattributed beyond
  `extension/unknown` unless extensions adopt the named API.
- Pixel, lifecycle, wrapper, and complexity tests make renderer changes more
  expensive to prepare, even though they reduce regression risk.

## Notes

This decision complements [ADR 0020](0020-bound-renderer-reactivity.md). The
unchanged-progress work and its deterministic complexity proofs are tracked in
[PR #15999](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15999) and its
follow-up [PR #16015](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16015).
