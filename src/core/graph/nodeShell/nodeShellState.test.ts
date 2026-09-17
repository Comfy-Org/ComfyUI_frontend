import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'

import { setAssertReporter } from '@/base/assert'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { createInputSlotView } from '@/lib/litegraph/src/node/slotDescriptorView'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { createUuidv4, zeroUuid } from '@/utils/uuid'

import {
  adoptCanonicalNodeState,
  createNodeShellState,
  unregisterNodeState
} from './nodeShellState'

describe('node shell state', () => {
  function addNodeToSubgraph() {
    const subgraph = createTestSubgraph()
    const node = new LGraphNode('Node')
    subgraph.add(node)
    return { subgraph, node }
  }

  /** The states the store holds for a subgraph, within its root graph's bucket. */
  function statesIn(subgraph: Subgraph): NodeState[] {
    return useNodeDataStore().getGraphNodesFor(
      subgraph.rootGraph.id,
      subgraph.id
    )
  }

  it('starts unregistered and unowned', () => {
    const node = new LGraphNode('Node')
    const state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'some/type',
      undefined
    )

    expect(state.id).toBe(UNASSIGNED_NODE_ID)
    expect(state.graphId).toBe(zeroUuid)
    expect(state.title).toBe('Node')
  })

  it('falls back to a placeholder title and an empty type', () => {
    const node = new LGraphNode('Node')
    const state = createNodeShellState(
      node,
      createInputSlotView,
      '',
      undefined,
      undefined
    )

    expect(state.title).toBe('Unnamed')
    expect(state.type).toBe('')
  })

  it('rehydrates plain input-slot writes for any NodeState producer, not just the LGraphNode constructor', () => {
    const node = new LGraphNode('Node')
    const state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'some/type',
      undefined
    )

    state.inputs.push({
      name: 'in',
      type: 'INT',
      link: null,
      boundingRect: new Float64Array(4)
    })

    expect(state.inputs[0]).toBeInstanceOf(NodeInputSlot)
  })

  it('buckets by root graph and partitions by owning graph', () => {
    const { subgraph, node } = addNodeToSubgraph()
    const rootId = subgraph.rootGraph.id

    expect(rootId).not.toBe(subgraph.id)
    expect(node._graphScope).toEqual(graphScopeOf(subgraph))
    expect(node._state.graphId).toBe(subgraph.id)

    const [registered] = statesIn(subgraph)
    expect(toRaw(node._state)).toBe(toRaw(registered))
    expect(useNodeDataStore().getGraphNodesFor(rootId, rootId)).toEqual([])
  })

  it('vacates its store entry on remove', () => {
    const { subgraph, node } = addNodeToSubgraph()

    subgraph.remove(node)

    expect(statesIn(subgraph)).toEqual([])
    expect(node._graphScope).toBeUndefined()
  })
})

describe('node registration invariants', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('refuses to register a node under a second root graph', () => {
    const first = new LGraph()
    const second = new LGraph()
    second.id = createUuidv4()
    const node = new LGraphNode('Node')
    first.add(node)

    expect(() => second.add(node)).toThrow(/different root graph/)
    expect(node._graphScope).toBeUndefined()
    expect(useNodeDataStore().getGraphNodesFor(first.id, first.id)).toEqual([])
  })

  it('drops the previous root entry rather than stranding it', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    const first = new LGraph()
    first.id = createUuidv4()
    const second = new LGraph()
    second.id = createUuidv4()
    const node = new LGraphNode('Node')
    first.add(node)

    second.add(node)

    const store = useNodeDataStore()
    const owningGraphId = node._state.graphId
    expect(store.getGraphNodesFor(first.id, owningGraphId)).toEqual([])
    expect(store.getGraphNodesFor(second.id, owningGraphId)).toHaveLength(1)
    expect(reporter).toHaveBeenCalledWith(
      expect.stringContaining('different root graph'),
      {
        nodeId: node.id,
        previousRootGraphId: first.id,
        nextRootGraphId: second.id
      }
    )
    setAssertReporter(null)
  })

  it('reports a state that drifted out of its bucket before unregistering', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    node._state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'test',
      undefined
    )

    expect(() => unregisterNodeState(node)).toThrow(/identity drift/)
    expect(node._graphScope).toBeUndefined()
  })

  it('reports the drifted node and graph as structured context', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    node._state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'test',
      undefined
    )

    unregisterNodeState(node)

    expect(reporter).toHaveBeenCalledWith(
      expect.stringContaining('identity drift'),
      { nodeId: node.id, rootGraphId: graph.id }
    )
    setAssertReporter(null)
  })
})

describe('adoptCanonicalNodeState', () => {
  class WidgetNode extends LGraphNode {
    constructor(type: string) {
      super(type, type)
      this.addInput('in', '*')
      this.addWidget('number', 'seed', 0, () => {})
    }
  }

  function ownedRecord() {
    const graph = new LGraph()
    const incumbent = new WidgetNode('a')
    incumbent.color = '#123'
    graph.add(incumbent)
    const record = useNodeDataStore().getNode(graph.id, incumbent.id)
    if (!record) throw new Error('incumbent should own a record')
    return { graph, incumbent, record }
  }

  it('moves an owned record from the incumbent onto the successor', () => {
    const { graph, incumbent, record } = ownedRecord()
    const scope = graphScopeOf(graph)
    const successor = new WidgetNode('b')
    const successorInputs = successor.inputs
    const stateBefore = { ...toRaw(record) }

    adoptCanonicalNodeState(graph, record, successor, incumbent)

    expect(toRaw(successor._state)).toBe(toRaw(record))
    expect(successor._graphScope).toEqual(scope)
    expect(useNodeDataStore().ownsNode(scope, successor._state)).toBe(true)
    expect(record.id).toBe(stateBefore.id)
    expect(record.graphId).toBe(stateBefore.graphId)
    expect(record.type).toBe('b')
    expect(record.color).toBeUndefined()
    expect(toRaw(record.inputs)).toBe(toRaw(successorInputs))

    expect(incumbent._graphScope).toBeUndefined()
    expect(toRaw(incumbent._state)).not.toBe(toRaw(record))
    expect(incumbent._state).toEqual(stateBefore)
  })

  it('adopts a record the incumbent no longer owns without touching it', () => {
    const { graph, incumbent, record: previous } = ownedRecord()
    const scope = graphScopeOf(graph)
    const nodeStore = useNodeDataStore()
    nodeStore.deleteNode(scope, incumbent._state)
    const record = nodeStore.registerNode(scope, {
      ...toRaw(previous),
      type: 'b'
    })
    if (!record) throw new Error('replacement record should register')
    const incumbentState = toRaw(incumbent._state)
    const successor = new WidgetNode('b')

    adoptCanonicalNodeState(graph, record, successor, incumbent)

    expect(toRaw(successor._state)).toBe(toRaw(record))
    expect(successor._graphScope).toEqual(scope)
    expect(toRaw(incumbent._state)).toBe(incumbentState)
    expect(incumbent._graphScope).toBeUndefined()
  })

  it('adopts a record with no incumbent', () => {
    const graph = new LGraph()
    const scope = graphScopeOf(graph)
    const prototype = new WidgetNode('b')
    const id = toNodeId(7)
    prototype.id = id
    const record = useNodeDataStore().registerNode(scope, {
      ...toRaw(prototype._state),
      graphId: graph.id
    })
    if (!record) throw new Error('record should register')
    const successor = new WidgetNode('b')

    adoptCanonicalNodeState(graph, record, successor)

    expect(toRaw(successor._state)).toBe(toRaw(record))
    expect(successor.id).toBe(id)
    expect(successor._graphScope).toEqual(scope)
  })

  describe('invariants', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true)
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('asserts the successor is not already registered', () => {
      const { graph, incumbent, record } = ownedRecord()
      const other = new LGraph()
      other.id = createUuidv4()
      const successor = new WidgetNode('b')
      other.add(successor)

      expect(() =>
        adoptCanonicalNodeState(graph, record, successor, incumbent)
      ).toThrow(/already registered/)
      expect(toRaw(incumbent._state)).toBe(toRaw(record))
      expect(incumbent._graphScope).toEqual(graphScopeOf(graph))
    })

    it('asserts the record is held by the store for this graph', () => {
      const { graph, incumbent, record } = ownedRecord()
      const successor = new WidgetNode('b')
      const foreign: NodeState = { ...toRaw(record) }

      expect(() =>
        adoptCanonicalNodeState(graph, foreign, successor, incumbent)
      ).toThrow(/not held by the store/)
      expect(successor._graphScope).toBeUndefined()
      expect(toRaw(incumbent._state)).toBe(toRaw(record))
    })
  })
})
