import { onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'

type GraphLike = LGraph | Subgraph
type StructureListener = () => void

type PatchRecord = {
  // Pre-patch callbacks, restored on detach only if our wrapper is still
  // installed (clobber-guard — don't overwrite a later extension's
  // reassignment).
  originalAdded: GraphLike['onNodeAdded']
  originalRemoved: GraphLike['onNodeRemoved']
  wrappedAdded: GraphLike['onNodeAdded']
  wrappedRemoved: GraphLike['onNodeRemoved']
  // Per-listener reference count. Every graph traversal visit
  // increments the count for the listener it reaches; detaching
  // decrements. A shared subgraph referenced from multiple parents
  // keeps its listener live as long as any reference remains.
  listeners: Map<StructureListener, number>
}

const patches = new WeakMap<GraphLike, PatchRecord>()

// Path-local cycle guard: sibling references to the same subgraph are
// counted separately (so refcounts stay accurate for copy/paste), while
// a malformed cyclic graph (A→B→A) does not blow the stack.
const forEachSubgraph = (
  graph: GraphLike,
  visit: (subgraph: GraphLike) => void,
  path: WeakSet<GraphLike> = new WeakSet()
): void => {
  for (const node of graph.nodes) {
    const subgraph = node.isSubgraphNode?.() ? node.subgraph : undefined
    if (!subgraph || path.has(subgraph)) continue
    path.add(subgraph)
    visit(subgraph)
    forEachSubgraph(subgraph, visit, path)
    path.delete(subgraph)
  }
}

const incrementListener = (
  record: PatchRecord,
  listener: StructureListener,
  by = 1
): void => {
  record.listeners.set(listener, (record.listeners.get(listener) ?? 0) + by)
}

const decrementListener = (
  graph: GraphLike,
  record: PatchRecord,
  listener: StructureListener,
  by = 1
): void => {
  const current = record.listeners.get(listener)
  if (current === undefined) return
  if (current <= by) record.listeners.delete(listener)
  else record.listeners.set(listener, current - by)

  if (record.listeners.size > 0) return

  // Last subscriber detached. Try to restore the pre-patch callbacks,
  // but only per-slot: if an extension chain-wrapped either callback,
  // our wrapper sits nested inside theirs — overwriting the slot would
  // clobber their handler.
  //
  // Invariant: only delete the PatchRecord from the registry once BOTH
  // wrappers are unhooked. A chain-wrapped wrapper stays alive inside
  // the extension's closure and reads `record.listeners` at call time;
  // a future subscription must reuse this same record so the new
  // listener joins the existing wrapper chain. Deleting early would
  // make the next `patchGraph` install a fresh wrapper on top of the
  // old one, stacking dead wrappers across open/close cycles.
  const unhookedAdded = graph.onNodeAdded === record.wrappedAdded
  const unhookedRemoved = graph.onNodeRemoved === record.wrappedRemoved
  if (unhookedAdded) graph.onNodeAdded = record.originalAdded
  if (unhookedRemoved) graph.onNodeRemoved = record.originalRemoved
  if (unhookedAdded && unhookedRemoved) patches.delete(graph)
}

const patchGraph = (graph: GraphLike): PatchRecord => {
  const existing = patches.get(graph)
  if (existing) {
    // The previous detach may have restored one slot to the captured
    // original (the side that was not chain-wrapped by an extension)
    // while leaving the record alive because the other slot still
    // pointed inside an extension's wrapper. Re-installing the wrapper
    // here lets the new subscription's events flow through it again.
    // The chain-wrapped slot stays untouched — the extension's wrapper
    // still calls our wrapper internally, so events still reach the
    // record.
    if (graph.onNodeAdded === existing.originalAdded) {
      graph.onNodeAdded = existing.wrappedAdded
    }
    if (graph.onNodeRemoved === existing.originalRemoved) {
      graph.onNodeRemoved = existing.wrappedRemoved
    }
    return existing
  }

  // Build wrappers over a shared `listeners` Map / captured originals so
  // the record can be constructed fully-typed without a partial-cast.
  // Dropping a wrapper field in a refactor becomes a compile error
  // instead of a runtime crash.
  const listeners = new Map<StructureListener, number>()
  const originalAdded = graph.onNodeAdded
  const originalRemoved = graph.onNodeRemoved

  // Per-listener isolation: a thrown listener must not block the
  // others. Today every listener is `() => tick.value++` and cannot
  // throw, but this is shared-registry infrastructure — a future
  // subscriber (undo-history hook, devtools probe) could legitimately
  // throw, and a silent fan-out failure would be hard to trace.
  const fanOut = (): void => {
    // Snapshot before iterating: a listener that subscribes/unsubscribes
    // during fan-out (registry refcount adjustment, undo-history hook)
    // would otherwise mutate `listeners` while a live MapIterator walks
    // it — defined behavior in V8 but not in the spec.
    const snapshot = [...listeners.keys()]
    for (const listener of snapshot) {
      try {
        listener()
      } catch (error) {
        console.error(
          '[useGraphStructureRevision] listener threw; continuing fan-out',
          error
        )
      }
    }
  }

  const wrappedAdded: GraphLike['onNodeAdded'] = function (
    this: GraphLike,
    node: LGraphNode
  ) {
    // Original first so downstream consumers (node registries, undo
    // history, custom-node extensions) see the added node before
    // listeners observe the revision bump.
    originalAdded?.call(this, node)
    if (node.isSubgraphNode?.() && node.subgraph) {
      // Propagate the parent's per-listener counts into the new
      // subgraph rather than just the listener identities. If this
      // graph is reached via multiple paths from the same subscriber
      // (or shares a subscriber's listener with another path), the
      // counts in `listeners` already reflect that. Dropping to keys
      // would attach the new subgraph at count 1 and silently leak it
      // when one of the parent paths later detaches.
      attachRecursive(node.subgraph, listeners)
    }
    fanOut()
  }

  const wrappedRemoved: GraphLike['onNodeRemoved'] = function (
    this: GraphLike,
    node: LGraphNode
  ) {
    originalRemoved?.call(this, node)
    if (node.isSubgraphNode?.() && node.subgraph) {
      // Symmetric to wrappedAdded — decrement the removed subgraph by
      // each listener's full count on this graph, not by 1, so the
      // tear-down matches what was attached.
      detachRecursive(node.subgraph, listeners)
    }
    fanOut()
  }

  const record: PatchRecord = {
    originalAdded,
    originalRemoved,
    wrappedAdded,
    wrappedRemoved,
    listeners
  }

  graph.onNodeAdded = wrappedAdded
  graph.onNodeRemoved = wrappedRemoved

  patches.set(graph, record)
  return record
}

const attachRecursive = (
  graph: GraphLike,
  listenerCounts: ReadonlyMap<StructureListener, number>
): void => {
  // Snapshot entries so concurrent edits to the source map (a parent
  // graph's listeners during dynamic add/remove) cannot mutate what
  // we apply.
  const snapshot = Array.from(listenerCounts)
  const rootRecord = patchGraph(graph)
  for (const [listener, count] of snapshot) {
    incrementListener(rootRecord, listener, count)
  }
  forEachSubgraph(graph, (subgraph) => {
    const subRecord = patchGraph(subgraph)
    for (const [listener, count] of snapshot) {
      incrementListener(subRecord, listener, count)
    }
  })
}

const detachRecursive = (
  graph: GraphLike,
  listenerCounts: ReadonlyMap<StructureListener, number>
): void => {
  const snapshot = Array.from(listenerCounts)
  const rootRecord = patches.get(graph)
  if (rootRecord) {
    for (const [listener, count] of snapshot) {
      decrementListener(graph, rootRecord, listener, count)
    }
  }
  forEachSubgraph(graph, (subgraph) => {
    const record = patches.get(subgraph)
    if (!record) return
    for (const [listener, count] of snapshot) {
      decrementListener(subgraph, record, listener, count)
    }
  })
}

/**
 * Reactive counter that bumps whenever the resolved graph hierarchy gains or
 * loses a node — including inside nested subgraphs. Consumers read it as a
 * dependency so their computeds re-run on in-place structural edits; `LGraph`
 * itself is not reactive, so watching a graph ref alone misses delete / paste
 * / duplicate without a workflow swap.
 *
 * The composable replaces `graph.onNodeAdded` / `graph.onNodeRemoved` with
 * wrappers that invoke the original callback and then fan out to every
 * subscribed listener. A per-listener reference count keeps shared subgraphs
 * live while any parent still references them. A clobber-guard on detach
 * preserves later extension reassignments (at the cost of losing revision
 * tracking if an extension overwrites without chain-calling — that is the
 * extension's contract to honour).
 */
export const useGraphStructureRevision = (
  graph: MaybeRefOrGetter<GraphLike | null | undefined>
): Readonly<Ref<number>> => {
  const tick = ref(0)
  const listener: StructureListener = () => {
    tick.value++
  }
  // Single-listener-with-count-1 map reused across this composable's
  // attach / detach calls. A new subscription contributes one path's
  // worth of listening per graph it traverses.
  const listenerMap: ReadonlyMap<StructureListener, number> = new Map([
    [listener, 1]
  ])
  let attachedTo: GraphLike | null = null

  watch(
    () => toValue(graph),
    (resolved) => {
      if (attachedTo) {
        detachRecursive(attachedTo, listenerMap)
        attachedTo = null
      }
      if (resolved) {
        attachRecursive(resolved, listenerMap)
        attachedTo = resolved
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    if (attachedTo) detachRecursive(attachedTo, listenerMap)
  })

  return tick
}
