import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, watchEffect } from 'vue'

import { useGraphStructureRevision } from '@/composables/node/useGraphStructureRevision'
import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'

// -----------------------------------------------------------------------------
// Helpers — minimal LGraph-shaped stubs sufficient for the composable under
// test. It only touches `nodes`, `onNodeAdded`, `onNodeRemoved`, and the
// subgraph predicate / reference on child nodes.
// -----------------------------------------------------------------------------

type GraphLike = LGraph | Subgraph

type StubNode = LGraphNode & {
  _subgraph?: GraphLike
}

type StubGraph = GraphLike & {
  nodes: StubNode[]
  onNodeAdded?: (this: GraphLike, node: LGraphNode) => void
  onNodeRemoved?: (this: GraphLike, node: LGraphNode) => void
}

const makeStubGraph = (nodes: StubNode[] = []): StubGraph => {
  const graph = {
    nodes,
    onNodeAdded: undefined,
    onNodeRemoved: undefined
  } as unknown as StubGraph
  return graph
}

const makePlainNode = (id: number): StubNode =>
  ({
    id,
    isSubgraphNode: () => false,
    subgraph: undefined
  }) as unknown as StubNode

const makeSubgraphNode = (id: number, subgraph: StubGraph): StubNode =>
  ({
    id,
    isSubgraphNode: () => true,
    subgraph
  }) as unknown as StubNode

const triggerAdded = (graph: StubGraph, node: StubNode) => {
  graph.nodes.push(node)
  graph.onNodeAdded?.call(graph, node)
}

const triggerRemoved = (graph: StubGraph, node: StubNode) => {
  graph.nodes = graph.nodes.filter((n) => n !== node)
  graph.onNodeRemoved?.call(graph, node)
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useGraphStructureRevision', () => {
  let graph: StubGraph

  beforeEach(() => {
    graph = makeStubGraph()
  })

  it('bumps the tick when a node is added at the root', () => {
    const scope = effectScope()
    const tick = scope.run(() => useGraphStructureRevision(graph))!
    const before = tick.value

    triggerAdded(graph, makePlainNode(1))

    expect(tick.value).toBe(before + 1)
    scope.stop()
  })

  it('bumps the tick when a node is removed at the root', () => {
    const existing = makePlainNode(7)
    graph = makeStubGraph([existing])
    const scope = effectScope()
    const tick = scope.run(() => useGraphStructureRevision(graph))!
    const before = tick.value

    triggerRemoved(graph, existing)

    expect(tick.value).toBe(before + 1)
    scope.stop()
  })

  it('preserves an original onNodeAdded callback that was installed before subscribing', () => {
    const calls: number[] = []
    graph.onNodeAdded = function (node: LGraphNode) {
      calls.push(Number(node.id))
    }

    const scope = effectScope()
    scope.run(() => useGraphStructureRevision(graph))

    triggerAdded(graph, makePlainNode(42))

    expect(calls).toEqual([42])
    scope.stop()
  })

  it('survives two concurrent subscribers on the same graph', () => {
    // Regression guard for the chain-style patch: the sign-in dialog opens
    // the aggregator and the row composable on the same graph, both
    // installing a revision subscription. Under the previous impl the second
    // installer's unmount restored the original callback and wiped the
    // first's wrapper; under the shared-registry impl both stay live.
    const scopeA = effectScope()
    const scopeB = effectScope()
    const tickA = scopeA.run(() => useGraphStructureRevision(graph))!
    const tickB = scopeB.run(() => useGraphStructureRevision(graph))!

    triggerAdded(graph, makePlainNode(1))
    expect(tickA.value).toBe(1)
    expect(tickB.value).toBe(1)

    // Detach B — A's subscription must continue to fire.
    scopeB.stop()

    triggerAdded(graph, makePlainNode(2))
    expect(tickA.value).toBe(2)
    expect(tickB.value).toBe(1)

    scopeA.stop()
  })

  it('restores the original callbacks after the last subscriber detaches', () => {
    const calls: number[] = []
    const original = function (node: LGraphNode) {
      calls.push(Number(node.id))
    }
    graph.onNodeAdded = original

    const scope = effectScope()
    scope.run(() => useGraphStructureRevision(graph))
    scope.stop()

    expect(graph.onNodeAdded).toBe(original)
    triggerAdded(graph, makePlainNode(5))
    expect(calls).toEqual([5])
  })

  it('bumps on structural edits inside a nested subgraph present at subscribe time', () => {
    // The aggregator walks subgraphs via reduceAllNodes; the reactivity
    // signal has to cover them too, otherwise deleting a priced api-node
    // inside a subgraph leaves the aggregate stale.
    const subgraph = makeStubGraph()
    const subgraphNode = makeSubgraphNode(100, subgraph)
    graph = makeStubGraph([subgraphNode])

    const scope = effectScope()
    const tick = scope.run(() => useGraphStructureRevision(graph))!

    triggerAdded(subgraph, makePlainNode(1))
    expect(tick.value).toBe(1)

    triggerRemoved(subgraph, subgraph.nodes[0])
    expect(tick.value).toBe(2)

    scope.stop()
  })

  it('attaches newly-added subgraphs on the fly so their mutations also tick', () => {
    const scope = effectScope()
    const tick = scope.run(() => useGraphStructureRevision(graph))!

    const newSubgraph = makeStubGraph()
    const subgraphNode = makeSubgraphNode(200, newSubgraph)
    triggerAdded(graph, subgraphNode)

    // Root add ticked once; adding inside the freshly-attached subgraph
    // should now tick again without the caller re-subscribing.
    expect(tick.value).toBe(1)
    triggerAdded(newSubgraph, makePlainNode(3))
    expect(tick.value).toBe(2)

    scope.stop()
  })

  it('keeps listeners attached when a removed node shares its subgraph with another node', () => {
    // Copy/paste can produce two nodes pointing at the same subgraph
    // instance. Removing one node must not strip the subgraph's listener
    // set while the other node still holds the reference — doing so would
    // silently break reactivity for mutations inside the subgraph.
    const subgraph = makeStubGraph()
    const first = makeSubgraphNode(400, subgraph)
    const second = makeSubgraphNode(401, subgraph)
    graph = makeStubGraph([first, second])

    const scope = effectScope()
    const tick = scope.run(() => useGraphStructureRevision(graph))!

    triggerRemoved(graph, first)
    const afterRemoval = tick.value

    // Mutating the still-referenced subgraph must continue to bump the
    // tick even though one of the referencing nodes was removed.
    triggerAdded(subgraph, makePlainNode(1))
    expect(tick.value).toBeGreaterThan(afterRemoval)

    scope.stop()
  })

  it('detaches listeners from a removed subgraph so further mutations do not leak', () => {
    // Undo history can keep a deleted subgraph alive past its removal;
    // without an explicit detach on remove, its listener set stays
    // populated and any future mutation inside the orphaned subgraph
    // would tick a ref whose scope has moved on.
    const subgraph = makeStubGraph()
    const subgraphNode = makeSubgraphNode(300, subgraph)
    graph = makeStubGraph([subgraphNode])

    const scope = effectScope()
    const tick = scope.run(() => useGraphStructureRevision(graph))!

    triggerRemoved(graph, subgraphNode)
    const afterRemoval = tick.value

    // Mutating the orphaned subgraph must not bump the tick anymore —
    // the root graph's removal callback severed the subscription.
    triggerAdded(subgraph, makePlainNode(9))
    expect(tick.value).toBe(afterRemoval)

    scope.stop()
  })

  it('leaves a later extension reassignment in place after the last subscriber detaches', () => {
    // If an extension reassigns the callback slot after our wrapper is
    // installed without chain-calling the previous value, the wrapper is
    // dislodged. On detach, restoring the captured original on top of
    // the extension's handler would silently destroy it. The clobber-
    // guard only restores when our wrapper is still the current slot.
    const scope = effectScope()
    scope.run(() => useGraphStructureRevision(graph))

    const replacement = function () {}
    graph.onNodeAdded = replacement as typeof graph.onNodeAdded
    graph.onNodeRemoved = replacement as typeof graph.onNodeRemoved

    scope.stop()

    expect(graph.onNodeAdded).toBe(replacement)
    expect(graph.onNodeRemoved).toBe(replacement)
  })

  it('reuses the wrapper chain on resubscribe when an extension chain-wraps us', () => {
    // Regression guard for the re-subscribe stacking bug. When an
    // extension chain-wraps our wrapper after install, the detach
    // cannot restore the slot — ours is nested inside theirs. Our
    // wrapper stays alive through the extension's `old` reference and
    // reads `listeners` at call time. A fresh subscription must reuse
    // the existing record so the new listener joins the same wrapper
    // chain; deleting the record early would stack a fresh wrapper on
    // top, leaving the original dangling and dead on every open/close
    // cycle.
    const events: string[] = []

    const scopeFirst = effectScope()
    scopeFirst.run(() => useGraphStructureRevision(graph))

    // Extension chain-wraps the current slot (our wrapper) after the
    // first subscribe — typical ComfyUI extension pattern.
    const chained = graph.onNodeAdded
    graph.onNodeAdded = function (node: LGraphNode) {
      chained?.call(this, node)
      events.push(`ext:${Number(node.id)}`)
    }

    // Detach first subscriber. Slot cannot be unhooked (chained wrapper
    // is the slot; ours sits nested inside).
    scopeFirst.stop()

    // Second subscription. Must reuse the existing wrapper record so
    // its listener bumps on mutations through the chain.
    const scopeSecond = effectScope()
    const tickSecond = scopeSecond.run(() => useGraphStructureRevision(graph))!

    triggerAdded(graph, makePlainNode(1))

    expect(tickSecond.value).toBe(1)
    expect(events).toEqual(['ext:1'])

    scopeSecond.stop()
  })

  it('keeps a shared subgraph live for one parent after the other parent detaches', () => {
    // A subgraph instance referenced from two independent parent graphs
    // sees two separate attaches — one per parent. Detaching one parent
    // must not strip the other parent's listener from the shared
    // subgraph. Per-listener reference counting makes this correct
    // regardless of how far apart the parents sit in the hierarchy.
    const shared = makeStubGraph()
    const parentA = makeStubGraph([makeSubgraphNode(1, shared)])
    const parentB = makeStubGraph([makeSubgraphNode(2, shared)])

    const scopeA = effectScope()
    const scopeB = effectScope()
    const tickA = scopeA.run(() => useGraphStructureRevision(parentA))!
    const tickB = scopeB.run(() => useGraphStructureRevision(parentB))!

    triggerAdded(shared, makePlainNode(10))
    expect(tickA.value).toBe(1)
    expect(tickB.value).toBe(1)

    scopeA.stop()

    triggerAdded(shared, makePlainNode(11))
    expect(tickA.value).toBe(1)
    expect(tickB.value).toBe(2)

    scopeB.stop()
  })

  it('does not recurse infinitely on cyclic subgraph references', () => {
    // Malformed graphs (custom-node edge case) can produce A→B→A
    // subgraph cycles. The traversal must short-circuit when it
    // re-enters a graph already on the current descent path.
    const graphA = makeStubGraph()
    const graphB = makeStubGraph()
    graphA.nodes = [makeSubgraphNode(1, graphB)]
    graphB.nodes = [makeSubgraphNode(2, graphA)]

    const scope = effectScope()
    expect(() => {
      scope.run(() => useGraphStructureRevision(graphA))
    }).not.toThrow()
    scope.stop()
  })

  it('runs the original onNodeAdded callback before notifying subscribers', () => {
    // Listeners that traverse the graph on notification (a future
    // consumer, e.g., a registry rebuild) expect the added node to be
    // present in any index the original callback populates. Lock in the
    // "original first, notify after" contract by observing that a
    // listener installed via watchEffect sees a tick value only after
    // the original callback has run.
    const events: string[] = []
    graph.onNodeAdded = function () {
      events.push('original')
    }

    const scope = effectScope()
    scope.run(() => {
      const tick = useGraphStructureRevision(graph)
      // Run the effect synchronously on next tick-bump; record when it
      // observes the bumped value relative to the original callback.
      watchEffect(
        () => {
          if (tick.value > 0) events.push(`listener:${tick.value}`)
        },
        { flush: 'sync' }
      )
    })

    triggerAdded(graph, makePlainNode(12))

    // Expected: original ran first, then the reactive listener fired.
    // If the wrapper ordering flipped back to notify-first, the sequence
    // would be ['listener:1', 'original'].
    expect(events).toEqual(['original', 'listener:1'])

    scope.stop()
  })

  it('keeps a dynamically-added nested subgraph alive after one parent host is removed', () => {
    // Reproduces the count-loss bug for dynamic nested subgraphs under
    // multiply-instantiated parents. The parent graph references the
    // shared subgraph S via two SubgraphNode hosts, so S accrues a
    // listener count of 2. When a nested subgraph T is later added
    // inside S, T must inherit count 2 — otherwise removing one of S's
    // hosts decrements T to 0 and T's revision tracking is silently
    // detached even though the second host still reaches it.
    const sharedSubgraph = makeStubGraph()
    const nestedSubgraph = makeStubGraph()
    const host1 = makeSubgraphNode(101, sharedSubgraph)
    const host2 = makeSubgraphNode(102, sharedSubgraph)
    graph.nodes = [host1, host2]

    const scope = effectScope()
    const tick = scope.run(() => useGraphStructureRevision(graph))!

    // Dynamically add a SubgraphNode inside the shared subgraph that
    // points at a previously-untracked nested subgraph.
    const nestedHost = makeSubgraphNode(201, nestedSubgraph)
    triggerAdded(sharedSubgraph, nestedHost)
    const tickAfterDynamicAdd = tick.value

    // Remove one of the two hosts pointing at the shared subgraph.
    // The other host still reaches sharedSubgraph and through it the
    // nested subgraph, so revision tracking must remain attached.
    triggerRemoved(graph, host1)

    // A mutation inside the nested subgraph must still bump the tick;
    // if the nested subgraph leaked, the tick would not advance.
    const before = tick.value
    triggerAdded(nestedSubgraph, makePlainNode(999))
    expect(tick.value).toBeGreaterThan(before)
    expect(tickAfterDynamicAdd).toBeGreaterThan(0)

    scope.stop()
  })
})
