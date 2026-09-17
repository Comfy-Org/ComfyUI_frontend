import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraphData,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { widgetId } from '@/types/widgetId'

/**
 * `LGraph.adoptCanonicalNode` replaces the live node for a canonical record
 * with a fresh successor instance, atomically from the caller's point of view:
 * either the successor ends up attached and owning the record, or the graph,
 * the record and the incumbent are left as they were.
 *
 * The graph owns every step that touches `_nodes`, `_nodes_by_id`, node
 * `graph`/`_graphScope`/`_state`, the node store, the widget store and the
 * layout attachment. Callers (the agent materializer, node replacement) only
 * hand over the record, the successor and an optional `configure` hook.
 *
 * Program context: ADR-034 (graph-owned node adoption); DrJKL invariants on
 * PR #17264 — single widget-slot authority, no ghost widgets on rollback,
 * no ownership leak on failure.
 */

class ANode extends LGraphNode {
  constructor(type = 'test/a') {
    super('a', type)
    this.addInput('in', '*')
    this.addOutput('out', '*')
    this.addWidget('number', 'seed', 0, () => {})
  }
}

class BNode extends LGraphNode {
  constructor() {
    super('b', 'test/b')
    this.addInput('in', '*')
    this.addOutput('out', '*')
    this.addWidget('number', 'seed', 0, () => {})
    this.addWidget('number', 'steps', 20, () => {})
  }
}

/** Same widget name as {@link ANode} but a different widget type. */
class TextSeedNode extends LGraphNode {
  constructor() {
    super('text-seed', 'test/text-seed')
    this.addInput('in', '*')
    this.addOutput('out', '*')
    this.addWidget('text', 'seed', 'x', () => {})
  }
}

class ThrowsOnAddedNode extends BNode {
  override onAdded(): void {
    throw new Error('onAdded exploded')
  }
}

class ThrowsOnRemovedNode extends ANode {
  constructor() {
    super('test/throws-on-removed')
  }

  override onRemoved(): void {
    throw new Error('onRemoved exploded')
  }
}

class SourceNode extends LGraphNode {
  constructor() {
    super('source', 'test/source')
    this.addOutput('out', '*')
  }
}

beforeEach(() => {
  layoutStore.resetForTests()
  LiteGraph.registerNodeType('test/a', ANode)
  LiteGraph.registerNodeType('test/b', BNode)
  LiteGraph.registerNodeType('test/text-seed', TextSeedNode)
  LiteGraph.registerNodeType('test/throws-on-added', ThrowsOnAddedNode)
  LiteGraph.registerNodeType('test/throws-on-removed', ThrowsOnRemovedNode)
  LiteGraph.registerNodeType('test/source', SourceNode)
})

/** Id of the record {@link graphWithDetachedRecord} registers without a live node. */
const DETACHED_ID = toNodeId(42)

function seedWidgetId(graph: LGraph, node: Pick<LGraphNode, 'id'>) {
  return widgetId(graph.rootGraph.id, node.id, 'seed')
}

/** A graph holding one live `ANode` that owns its canonical record. */
function graphWithOwnedIncumbent() {
  const graph = new LGraph()
  const incumbent = new ANode()
  graph.add(incumbent)
  incumbent.widgets![0].value = 5
  const record = useNodeDataStore().getNode(graph.id, incumbent.id)
  if (!record) throw new Error('incumbent should own a record')
  return { graph, incumbent, record }
}

/**
 * A graph holding one live `ANode` whose canonical record was re-registered
 * by another authority (the agent follower) with a new type. The live node no
 * longer owns the record; it is an orphaned adapter.
 */
function graphWithOrphanIncumbent() {
  const { graph, incumbent } = graphWithOwnedIncumbent()
  const scope = graphScopeOf(graph)
  const nodeStore = useNodeDataStore()
  const previous = toRaw(incumbent._state)
  if (!nodeStore.deleteNode(scope, incumbent._state))
    throw new Error('incumbent record should be deletable')
  const record = nodeStore.registerNode(scope, {
    ...previous,
    type: 'test/b'
  })
  if (!record) throw new Error('replacement record should register')
  return { graph, incumbent, record }
}

/** A graph holding a canonical record and widget value but no live node. */
function graphWithDetachedRecord() {
  const graph = new LGraph()
  const scope = graphScopeOf(graph)
  const prototype = new BNode()
  prototype.id = DETACHED_ID
  const record = useNodeDataStore().registerNode(scope, {
    ...toRaw(prototype._state),
    graphId: graph.id
  })
  if (!record) throw new Error('detached record should register')
  useWidgetValueStore().registerWidget(seedWidgetId(graph, record), {
    name: 'seed',
    type: 'number',
    value: 7,
    options: {}
  })
  return { graph, record }
}

function expectUnchangedGraph(
  graph: LGraph,
  incumbent: LGraphNode,
  record: NodeState,
  versionBefore: number
) {
  expect(graph._nodes).toEqual([incumbent])
  expect(graph.getNodeById(incumbent.id)).toBe(incumbent)
  expect(graph._nodes_by_id[incumbent.id]).toBe(incumbent)
  expect(incumbent.graph).toBe(graph)
  expect(incumbent._graphScope).toEqual(graphScopeOf(graph))
  expect(useNodeDataStore().getNode(graph.id, incumbent.id)).toBe(record)
  expect(record.type).toBe('test/a')
  expect(graph._version).toBe(versionBefore)
}

function expectDetachedSuccessor(successor: LGraphNode) {
  expect(successor.graph).toBeNull()
  expect(successor._graphScope).toBeUndefined()
}

describe('LGraph.adoptCanonicalNode', () => {
  describe('success', () => {
    it('hands an owned record from the incumbent to the successor', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const scope = graphScopeOf(graph)
      const versionBefore = graph._version
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result).toEqual({ status: 'replaced', node: successor })
      expect(graph._nodes).toEqual([successor])
      expect(graph.getNodeById(incumbent.id)).toBe(successor)
      expect(successor.id).toBe(incumbent.id)
      expect(toRaw(successor._state)).toBe(toRaw(record))
      expect(successor._graphScope).toEqual(scope)
      expect(useNodeDataStore().ownsNode(scope, successor._state)).toBe(true)
      expect(record.type).toBe('test/b')

      expectDetachedSuccessor(incumbent)
      expect(toRaw(incumbent._state)).not.toBe(toRaw(record))
      expect(incumbent._state.type).toBe('test/a')

      expect(graph._version).toBe(versionBefore + 1)
      expect(layoutStore.getNodeLayout(graph.id, successor.id)).not.toBeNull()
    })

    it('adopts a successor whose constructor pre-bound `graph` before add', () => {
      // SubgraphNode sets `this.graph = graph` in its constructor; a graph
      // reference alone does not make a node attached.
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new BNode()
      successor.graph = graph

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result).toEqual({ status: 'replaced', node: successor })
      expect(graph._nodes).toEqual([successor])
      expect(graph.getNodeById(incumbent.id)).toBe(successor)
      expect(successor.graph).toBe(graph)
    })

    it('keeps the same-name widget value across the hand-over', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new BNode()

      graph.adoptCanonicalNode(record, successor, { incumbent })

      expect(successor.widgets![0].value).toBe(5)
      expect(
        useWidgetValueStore().getWidget(seedWidgetId(graph, successor))?.value
      ).toBe(5)
    })

    it('adopts an orphaned incumbent record, keeping links and order', () => {
      const { graph, incumbent, record } = graphWithOrphanIncumbent()
      const source = new SourceNode()
      graph.add(source)
      const link = source.connect(0, incumbent, 0)
      if (!link) throw new Error('link should connect')
      const versionBefore = graph._version
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result.status).toBe('replaced')
      expect(graph._nodes).toEqual([source, successor])
      expect(graph._nodes_by_id[incumbent.id]).toBe(successor)
      expect(graph.links.get(link.id)?.target_id).toBe(successor.id)
      expect(source.outputs[0].links).toEqual([link.id])
      expect(graph._nodes_in_order).toEqual([source, successor])
      expect(toRaw(successor._state)).toBe(toRaw(record))
      expectDetachedSuccessor(incumbent)
      expect(graph._version).toBe(versionBefore + 1)
    })

    it('attaches a successor for a record with no live node', () => {
      const { graph, record } = graphWithDetachedRecord()
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor)

      expect(result).toEqual({ status: 'replaced', node: successor })
      expect(graph._nodes).toEqual([successor])
      expect(successor.id).toBe(DETACHED_ID)
      expect(toRaw(successor._state)).toBe(toRaw(record))
      expect(successor.widgets![0].value).toBe(7)
    })

    it('runs the configure hook on the attached successor', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new BNode()
      const configure = vi.fn((node: LGraphNode) => {
        expect(node.graph).toBe(graph)
        expect(toRaw(node._state)).toBe(toRaw(record))
      })

      graph.adoptCanonicalNode(record, successor, { incumbent, configure })

      expect(configure).toHaveBeenCalledExactlyOnceWith(successor)
    })
  })

  describe('rollback', () => {
    it('restores everything when the configure hook throws', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const versionBefore = graph._version
      const recordBefore = { ...toRaw(record) }
      const successor = new BNode()
      const cause = new Error('configure exploded')

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: () => {
          throw cause
        }
      })

      expect(result).toEqual({
        status: 'failed',
        stage: 'configure',
        cause,
        rollbackFailures: []
      })
      expectUnchangedGraph(graph, incumbent, record, versionBefore)
      expect(toRaw(incumbent._state)).toBe(toRaw(record))
      expect({ ...toRaw(record) }).toEqual(recordBefore)
      expectDetachedSuccessor(successor)

      const seed = seedWidgetId(graph, incumbent)
      const widgetStore = useWidgetValueStore()
      expect(widgetStore.getNodeWidgetIds(graph.id, incumbent.id)).toEqual([
        seed
      ])
      expect(widgetStore.getWidget(seed)?.value).toBe(5)
      expect(incumbent.widgets![0].value).toBe(5)
    })

    it('restores nested record fields the configure hook mutated in place', () => {
      // `LGraphNode.configure` writes into `properties`/`flags` in place
      // rather than replacing them; a rollback must hand the incumbent back
      // the values it had, not the containers the successor scribbled on.
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      incumbent.properties.seedMode = 'fixed'
      incumbent.flags.collapsed = false
      incumbent.inputs[0].label = 'before'
      const recordBefore = JSON.parse(JSON.stringify(toRaw(record)))
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: (node) => {
          node.properties.seedMode = 'randomize'
          node.properties.extra = 1
          node.flags.collapsed = true
          node.inputs[0].label = 'after'
          node.title = 'renamed'
          throw new Error('configure exploded')
        }
      })

      expect(result.status).toBe('failed')
      expect(JSON.parse(JSON.stringify(toRaw(record)))).toEqual(recordBefore)
      expect(incumbent.properties).toEqual({ seedMode: 'fixed' })
      expect(incumbent.flags.collapsed).toBe(false)
      expect(incumbent.inputs[0].label).toBe('before')
      expect(incumbent.title).toBe('a')
    })

    it('restores widget options the configure hook mutated in place', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      incumbent.widgets![0].options.max = 10
      const seed = seedWidgetId(graph, incumbent)
      const widgetStore = useWidgetValueStore()
      const successor = new BNode()

      graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: (node) => {
          node.widgets![0].options.max = 99
          node.widgets![0].options.step = 5
          throw new Error('configure exploded')
        }
      })

      expect(widgetStore.getWidget(seed)?.options).toEqual({ max: 10 })
      expect(incumbent.widgets![0].options).toEqual({ max: 10 })
    })

    it('rebinds incumbent widgets the successor had re-typed', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new TextSeedNode()

      graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: () => {
          throw new Error('configure exploded')
        }
      })

      const seed = seedWidgetId(graph, incumbent)
      const widgetStore = useWidgetValueStore()
      expect(widgetStore.getWidget(seed)?.type).toBe('number')
      expect(widgetStore.getWidget(seed)?.value).toBe(5)
      incumbent.widgets![0].value = 9
      expect(widgetStore.getWidget(seed)?.value).toBe(9)
    })

    it('restores an orphaned incumbent without re-registering it', () => {
      const { graph, incumbent, record } = graphWithOrphanIncumbent()
      const versionBefore = graph._version
      const stateBefore = toRaw(incumbent._state)
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: () => {
          throw new Error('configure exploded')
        }
      })

      expect(result.status).toBe('failed')
      expect(graph._nodes).toEqual([incumbent])
      expect(graph.getNodeById(incumbent.id)).toBe(incumbent)
      expect(incumbent.graph).toBe(graph)
      expect(toRaw(incumbent._state)).toBe(stateBefore)
      expect(useNodeDataStore().getNode(graph.id, incumbent.id)).toBe(record)
      expect(record.type).toBe('test/b')
      expect(graph._version).toBe(versionBefore)
      expectDetachedSuccessor(successor)

      const retry = graph.adoptCanonicalNode(record, new BNode(), {
        incumbent
      })
      expect(retry.status).toBe('replaced')
    })

    it('reports the add stage when the successor onAdded throws', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const versionBefore = graph._version
      const successor = new ThrowsOnAddedNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('add')
      expect(result.cause).toBeInstanceOf(Error)
      expect(result.rollbackFailures).toEqual([])
      expectUnchangedGraph(graph, incumbent, record, versionBefore)
      expectDetachedSuccessor(successor)
    })

    it('reports the detach stage when the incumbent onRemoved throws', () => {
      const graph = new LGraph()
      const incumbent = new ThrowsOnRemovedNode()
      graph.add(incumbent)
      const record = useNodeDataStore().getNode(graph.id, incumbent.id)!
      const versionBefore = graph._version
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('detach')
      expect(result.rollbackFailures).toEqual([])
      expect(graph._nodes).toEqual([incumbent])
      expect(incumbent.graph).toBe(graph)
      expect(toRaw(incumbent._state)).toBe(toRaw(record))
      expect(record.type).toBe('test/throws-on-removed')
      expect(graph._version).toBe(versionBefore)
      expectDetachedSuccessor(successor)
    })

    it('keeps a detached record and its widget values on failure', () => {
      const { graph, record } = graphWithDetachedRecord()
      const versionBefore = graph._version
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        configure: () => {
          throw new Error('configure exploded')
        }
      })

      expect(result.status).toBe('failed')
      expect(graph._nodes).toEqual([])
      expect(graph.getNodeById(DETACHED_ID)).toBeNull()
      expect(useNodeDataStore().getNode(graph.id, DETACHED_ID)).toBe(record)
      expect(record.type).toBe('test/b')
      expect(graph._version).toBe(versionBefore)
      expectDetachedSuccessor(successor)

      const widgetStore = useWidgetValueStore()
      const seed = seedWidgetId(graph, record)
      expect(widgetStore.getNodeWidgetIds(graph.id, DETACHED_ID)).toEqual([
        seed
      ])
      expect(widgetStore.getWidget(seed)?.value).toBe(7)
    })

    it('collects rollback failures instead of throwing', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new BNode()
      const rollbackCause = new Error('onAdded exploded on reattach')
      let reattaching = false
      incumbent.onAdded = () => {
        if (reattaching) throw rollbackCause
      }

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: () => {
          reattaching = true
          throw new Error('configure exploded')
        }
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('configure')
      expect(result.rollbackFailures).toEqual([rollbackCause])
      expect(graph._nodes).toEqual([incumbent])
      expect(incumbent.graph).toBe(graph)
    })
  })

  describe('subgraph node incumbent', () => {
    /**
     * A root graph whose only live node is a `SubgraphNode` (the incumbent)
     * whose canonical record was re-registered with the type `test/b`. The
     * definition it instantiates has one interior node so the release side
     * effects (interior `onRemoved`, `rootGraph.subgraphs`) are observable.
     */
    function graphWithOrphanSubgraphIncumbent() {
      const graph = new LGraph()
      const subgraph = graph.createSubgraph(createTestSubgraphData())
      const interior = new LGraphNode('interior')
      interior.onRemoved = vi.fn()
      subgraph.add(interior)
      const incumbent = createTestSubgraphNode(subgraph)
      graph.add(incumbent)
      if (!graph.subgraphs.has(subgraph.id))
        throw new Error('definition should be registered on the root graph')

      const scope = graphScopeOf(graph)
      const nodeStore = useNodeDataStore()
      const previous = toRaw(incumbent._state)
      if (!nodeStore.deleteNode(scope, incumbent._state))
        throw new Error('incumbent record should be deletable')
      const record = nodeStore.registerNode(scope, {
        ...previous,
        type: 'test/b'
      })
      if (!record) throw new Error('replacement record should register')
      return { graph, subgraph, interior, incumbent, record }
    }

    it('keeps the incumbent definition when the replacement fails', () => {
      // Detaching the incumbent is what would normally release its
      // definition (no canonical record holds that type any more). A failed
      // replacement hands the incumbent back, so its definition must still
      // exist and its interior nodes must not have been torn down.
      const { graph, subgraph, interior, incumbent, record } =
        graphWithOrphanSubgraphIncumbent()
      const successor = new BNode()

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: () => {
          throw new Error('configure exploded')
        }
      })

      expect(result.status).toBe('failed')
      expect(graph.subgraphs.get(subgraph.id)).toBe(subgraph)
      expect(subgraph.nodes).toEqual([interior])
      expect(interior.onRemoved).not.toHaveBeenCalled()
      expect(graph._nodes).toEqual([incumbent])
      expect(incumbent.graph).toBe(graph)
      expect(incumbent.subgraph).toBe(subgraph)
      expectDetachedSuccessor(successor)
    })

    it('releases the incumbent definition once the replacement is live', () => {
      const { graph, subgraph, interior, incumbent, record } =
        graphWithOrphanSubgraphIncumbent()
      const successor = new BNode()
      const released: boolean[] = []

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        // The definition is still registered while the successor is being
        // configured; it goes away only after the replacement has succeeded.
        configure: () => released.push(graph.subgraphs.has(subgraph.id))
      })

      expect(result).toEqual({ status: 'replaced', node: successor })
      expect(released).toEqual([true])
      expect(graph.subgraphs.has(subgraph.id)).toBe(false)
      expect(interior.onRemoved).toHaveBeenCalledOnce()
      expect(graph._nodes).toEqual([successor])
    })
  })

  describe('guards', () => {
    it('rejects a successor that is already attached to a graph', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const versionBefore = graph._version
      const other = new LGraph()
      const successor = new BNode()
      other.add(successor)

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('precondition')
      expect(result.cause).toMatchObject({ code: 'successor_attached' })
      expectUnchangedGraph(graph, incumbent, record, versionBefore)
      expect(successor.graph).toBe(other)
    })

    it('rejects an incumbent that is not the live node for the record', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const stranger = new ANode()
      graph.add(stranger)
      const versionBefore = graph._version

      const result = graph.adoptCanonicalNode(record, new BNode(), {
        incumbent: stranger
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('precondition')
      expect(result.cause).toMatchObject({ code: 'incumbent_mismatch' })
      expect(graph._nodes).toEqual([incumbent, stranger])
      expect(graph._version).toBe(versionBefore)
    })

    it('rejects a record the store does not hold for this graph', () => {
      const { graph, incumbent } = graphWithOwnedIncumbent()
      const versionBefore = graph._version
      const foreign: NodeState = { ...toRaw(incumbent._state) }

      const result = graph.adoptCanonicalNode(foreign, new BNode(), {
        incumbent
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('precondition')
      expect(result.cause).toMatchObject({ code: 'record_not_owned' })
      expect(graph._nodes).toEqual([incumbent])
      expect(graph._version).toBe(versionBefore)
    })

    it('rolls back when LGraph.add refuses the successor without throwing', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const versionBefore = graph._version
      const successor = new BNode()
      vi.spyOn(graph, 'add').mockReturnValueOnce(undefined)

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('add')
      expect(result.cause).toMatchObject({ code: 'add_rejected' })
      expect(result.rollbackFailures).toEqual([])
      expectUnchangedGraph(graph, incumbent, record, versionBefore)
      expectDetachedSuccessor(successor)
    })

    it('disposes a successor that was never added when the detach stage fails', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new BNode()
      const onRemoved = vi.fn()
      successor.onRemoved = onRemoved
      incumbent.onRemoved = () => {
        throw new Error('cleanup failed')
      }

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('detach')
      expect(onRemoved).toHaveBeenCalledOnce()
      expectDetachedSuccessor(successor)
    })

    it('disposes an added successor exactly once when the configure stage fails', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new BNode()
      const onRemoved = vi.fn()
      successor.onRemoved = onRemoved

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: () => {
          throw new Error('configure failed')
        }
      })

      expect(result.status).toBe('failed')
      if (result.status !== 'failed') return
      expect(result.stage).toBe('configure')
      expect(onRemoved).toHaveBeenCalledOnce()
      expectDetachedSuccessor(successor)
    })

    it('restores a pre-bound `graph` reference on rollback instead of nulling it', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const versionBefore = graph._version
      const successor = new BNode()
      successor.graph = graph
      vi.spyOn(graph, 'add').mockReturnValueOnce(undefined)

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent
      })

      expect(result.status).toBe('failed')
      expectUnchangedGraph(graph, incumbent, record, versionBefore)
      expect(successor.graph).toBe(graph)
      expect(successor._graphScope).toBeUndefined()
    })

    it('returns reentrant when called from within its own configure hook', () => {
      const { graph, incumbent, record } = graphWithOwnedIncumbent()
      const successor = new BNode()
      let inner: unknown

      const result = graph.adoptCanonicalNode(record, successor, {
        incumbent,
        configure: (node) => {
          inner = graph.adoptCanonicalNode(record, new BNode(), {
            incumbent: node
          })
        }
      })

      expect(inner).toEqual({ status: 'reentrant' })
      expect(result).toEqual({ status: 'replaced', node: successor })
      expect(graph._nodes).toEqual([successor])
    })
  })
})
