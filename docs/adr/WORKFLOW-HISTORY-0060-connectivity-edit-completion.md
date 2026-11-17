# ADR-WORKFLOW-HISTORY-0060: Connectivity edit completion

Date: 2026-11-17

## Status

Accepted

## Context

Snapshot history usually infers completion from canvas events or manual capture.
Connectivity also runs without a gesture, and one link replacement can invoke
extensions that synchronously reconnect, reject, remove nodes, or load another
workflow. A null connection result does not mean topology stayed unchanged.

The root graph adapter survives workflow replacement, but its state does not.
Capturing whichever workflow is active after a callback can therefore record
the wrong document. Existing graph intents describe individual mutations and
already carry synchronous provenance. They do not identify completed edits.

## Decision

Bind connectivity completion to a workflow tracker and a root state lifetime
before executing the edit. Same-root, same-provenance reentrant connectivity
joins the existing scope. A multi-link drop supplies an outer scope so its
replacement links become one history step. Separate roots keep separate owners.

Connectivity marks applied mutations explicitly. A veto without mutation does
not complete an edit or capture unrelated pending changes. Completion runs
after synchronous callbacks. An interrupted edit still captures topology already
applied, while the original exception propagates. This boundary does not roll
back mutations or make callbacks transactional.

Discard completion if graph state or owner binding changed during the edit,
or the workflow unloaded its tracker. A live inactive owner may capture its own
graph, but cannot publish active-canvas or autoqueue events. Loading, history
restoration, capture suppression, and nonlocal provenance remain excluded.

History remains snapshot-based. Completion captures the supplied owner graph
without scheduling trailing debounce. Legacy capture inside an explicit scope
is ignored. A legacy transaction opened outside the scope still owns its
whole-operation capture. An earlier legacy debounce may update only its original
checkpoint. Gesture fallback remains for unmigrated operations.

Mixed-provenance edits retain their mutation provenance. A local snapshot may
include remote mutations made during its callbacks. This decision does not
provide actor-aware undo or selective rollback.

## Alternatives

Adding completion to the semantic graph-intent stream would mix edit boundaries
with mutation notifications and require unrelated consumers to filter them.
A direct owner binding keeps completion separate without introducing another
command bus.

Inferring success from a connection return value misses interrupted and
reentrant mutations. Using graph adapter identity alone misses workflow
replacement. Using the active workflow at completion loses the originating owner.

Command inverses and a workflow-wide transaction engine would change undo
semantics and extension behavior. They are outside this incremental migration.

## Consequences

Programmatic connectivity can create undo history without synthetic gestures.
Extension vetoes and callback ordering remain synchronous. Snapshot undo and
workflow serialization retain their existing formats.

Unmigrated selection, asynchronous widget, prompt, and editor-session callers
still require explicit completion boundaries in later slices. Text editors
retain editor-local undo until their session ends.
