import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import { LayoutSource } from '@/renderer/core/layout/types'
import { useMinimapGraph } from '@/renderer/extensions/minimap/composables/useMinimapGraph'
import { useExecutionStore } from '@/stores/executionStore'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import {
  createMockLGraph,
  createMockLGraphGroup,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'

function createReader(initialGraph: LGraph | null) {
  const graph = shallowRef(initialGraph)
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const reader = scope.run(() => useMinimapGraph(graph))
  assert.exists(reader)
  return { ...reader, graph, scope }
}

function createGraph(isRootGraph = true) {
  return createMockLGraph({
    id: '00000000-0000-0000-0000-000000000001',
    isRootGraph,
    _nodes: [
      createMockLGraphNode({
        id: toNodeId('1'),
        pos: [100, 100],
        size: [150, 80]
      }),
      createMockLGraphNode({
        id: toNodeId('2'),
        pos: [300, 200],
        size: [120, 60]
      })
    ]
  })
}

function registerLink(
  graph: LGraph,
  source: string,
  target: string,
  sourceSlot = 0,
  targetSlot = 0
) {
  const scope = graphScopeOf(graph)
  const previous = useLinkStore().getTopology(scope.rootGraphId, toLinkId(1))
  if (previous) useLinkStore().deleteLink(scope, previous)
  useLinkStore().registerLink(scope, {
    id: toLinkId(1),
    graphId: scope.owningGraphId,
    originNodeId: toNodeId(source),
    targetNodeId: toNodeId(target),
    originSlot: sourceSlot,
    targetSlot,
    type: 'INT'
  })
}

describe('useMinimapGraph', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  it('classifies the first reading and then quiet polls', () => {
    const reader = createReader(createGraph())
    expect(reader.checkForChanges()).toBe('geometry')
    expect(Array.from({ length: 10 }, () => reader.checkForChanges())).toEqual(
      Array(10).fill('none')
    )
  })

  it.for([true, false])(
    'reads and projects nodes with unencodable locator IDs (root=%s)',
    (isRootGraph) => {
      const graph = createGraph(isRootGraph)
      graph._nodes[0].id = toNodeId('node:\uD800')
      const reader = createReader(graph)
      expect(reader.checkForChanges()).toBe('geometry')
      expect(reader.checkForChanges()).toBe('none')
      expect(new MinimapDataSource(graph).getNodes()[0]).toMatchObject({
        id: 'node:\uD800',
        x: 100,
        y: 100,
        width: 150,
        height: 80,
        executionState: null
      })
    }
  )

  it('establishes a baseline even for an empty graph', () => {
    const graph = createMockLGraph({ id: 'empty', isRootGraph: true })
    const reader = createReader(graph)
    expect(reader.checkForChanges()).toBe('geometry')
    expect(reader.checkForChanges()).toBe('none')
    graph.events.dispatch('configured')
    expect(reader.checkForChanges()).toBe('geometry')
  })

  it.for<[string, (node: LGraphNode) => unknown]>([
    ['position', (node: LGraphNode) => (node.pos = [200, 150])],
    ['fractional position', (node: LGraphNode) => (node.pos = [100.5, 100])],
    [
      'rendered size',
      (node: LGraphNode) =>
        Object.defineProperty(node, 'renderingSize', { value: [240, 180] })
    ],
    ['identity', (node: LGraphNode) => (node.id = toNodeId('replacement'))]
  ])('classifies changed node %s as geometry', ([, mutate]) => {
    const graph = createGraph()
    const reader = createReader(graph)
    reader.checkForChanges()
    mutate(graph._nodes[0])
    expect(reader.checkForChanges()).toBe('geometry')
    expect(reader.checkForChanges()).toBe('none')
  })

  it.for<[string, (node: LGraphNode) => unknown]>([
    ['background', (node: LGraphNode) => (node.bgcolor = '#ff0000')],
    ['errors', (node: LGraphNode) => (node.has_errors = true)],
    ['mode', (node: LGraphNode) => (node.mode = 4)]
  ])('classifies changed node %s as picture only', ([, mutate]) => {
    const graph = createGraph()
    const reader = createReader(graph)
    reader.checkForChanges()
    mutate(graph._nodes[0])
    expect(reader.checkForChanges()).toBe('picture')
    expect(reader.checkForChanges()).toBe('none')
  })

  it('ignores unpainted properties and sub-quantum movement', () => {
    const graph = createGraph()
    const reader = createReader(graph)
    reader.checkForChanges()
    graph._nodes[0].title = 'Renamed'
    graph._nodes[0].pos = [100.01, 100]
    expect(reader.checkForChanges()).toBe('none')
  })

  it('classifies node addition and removal as geometry', () => {
    const graph = createGraph()
    const reader = createReader(graph)
    reader.checkForChanges()
    graph._nodes.push(createMockLGraphNode({ id: toNodeId('3') }))
    expect(reader.checkForChanges()).toBe('geometry')
    graph._nodes = []
    expect(reader.checkForChanges()).toBe('geometry')
    expect(reader.checkForChanges()).toBe('none')
  })

  it.for([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'does not let a nonfinite coordinate %s mask another node moving',
    (coordinate) => {
      const graph = createGraph()
      graph._nodes[1].pos = [coordinate, 0]
      const reader = createReader(graph)
      reader.checkForChanges()
      expect(reader.checkForChanges()).toBe('none')
      graph._nodes[0].pos = [120, 150]
      expect(reader.checkForChanges()).toBe('geometry')
    }
  )

  it('keeps global store-only geometry invalidation but ignores z-index', () => {
    const graph = createGraph()
    const nodeId = toNodeId('1')
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: graph.id,
      nodeId,
      layout: {
        id: nodeId,
        position: { x: 100, y: 100 },
        size: { width: 150, height: 80 },
        bounds: { x: 100, y: 100, width: 150, height: 80 },
        zIndex: 0,
        visible: true
      },
      timestamp: Date.now(),
      source: LayoutSource.Vue
    })
    const reader = createReader(graph)
    reader.checkForChanges()
    const mutations = useLayoutMutations(LayoutSource.Vue)
    mutations.setNodeZIndex(graph.id, nodeId, 42)
    expect(reader.checkForChanges()).toBe('none')
    mutations.moveNode(graph.id, nodeId, { x: 500, y: 500 })
    expect(graph._nodes[0].pos).toEqual([100, 100])
    expect(reader.checkForChanges()).toBe('geometry')

    graph._nodes[0].pos[0] -= 923521 / 8
    mutations.moveNode(graph.id, nodeId, { x: 600, y: 500 })
    expect(reader.checkForChanges()).toBe('geometry')
  })

  it.for<[string, (graph: LGraph) => unknown]>([
    ['node color', (graph) => (graph._nodes[0].bgcolor = '#2B0000')],
    ['group color', (graph) => (graph._groups[0].color = '#2B0000')],
    ['group position', (graph) => (graph._groups[0].pos = [201, 169])]
  ])('detects colliding %s changes without rebuilding bounds', ([, mutate]) => {
    const graph = createGraph()
    graph._nodes[0].bgcolor = '#1a0000'
    graph._groups = [
      createMockLGraphGroup({
        pos: [200, 200],
        size: [400, 300],
        color: '#1a0000'
      })
    ]
    const reader = createReader(graph)
    reader.checkForChanges()
    mutate(graph)
    expect(reader.checkForChanges()).toBe('picture')
    expect(reader.checkForChanges()).toBe('none')
  })

  it('classifies group geometry, color and removal as picture only', () => {
    const graph = createGraph()
    graph._groups = [
      createMockLGraphGroup({ pos: [0, 0], size: [400, 300], color: '#111' })
    ]
    const reader = createReader(graph)
    reader.checkForChanges()
    graph._groups[0].pos[0] = 250
    expect(reader.checkForChanges()).toBe('picture')
    graph._groups[0].size[1] = 500
    expect(reader.checkForChanges()).toBe('picture')
    graph._groups[0].color = '#fff'
    expect(reader.checkForChanges()).toBe('picture')
    graph._groups = []
    expect(reader.checkForChanges()).toBe('picture')
  })

  it.for([true, false])(
    'reads discrete execution state only for painted nodes (root=%s)',
    (isRootGraph) => {
      const graph = createGraph(isRootGraph)
      const states: ReturnType<
        typeof useExecutionStore
      >['nodeLocationProgressStates'] = {}
      vi.spyOn(
        useExecutionStore(),
        'nodeLocationProgressStates',
        'get'
      ).mockReturnValue(states)
      const locatorId = createNodeLocatorId(
        isRootGraph ? null : graph.id,
        toNodeId('1')
      )
      const unrelatedId = createNodeLocatorId(
        isRootGraph ? graph.id : null,
        toNodeId('1')
      )
      const reader = createReader(graph)
      reader.checkForChanges()
      states[unrelatedId] = {
        state: 'running',
        value: 1,
        max: 10,
        node_id: '1',
        prompt_id: 'job-1'
      }
      expect(reader.checkForChanges()).toBe('none')
      states[locatorId] = {
        state: 'running',
        value: 1,
        max: 10,
        node_id: '1',
        prompt_id: 'job-1'
      }
      expect(reader.checkForChanges()).toBe('picture')
      states[locatorId].value = 5
      expect(reader.checkForChanges()).toBe('none')
      states[locatorId].state = 'finished'
      expect(reader.checkForChanges()).toBe('picture')
      delete states[locatorId]
      expect(reader.checkForChanges()).toBe('picture')
    }
  )

  it.for<[string, string, string, string, string, number, number]>([
    ['alphabetic endpoint', 'alpha', 'beta', 'alpha', 'gamma', 0, 0],
    ['colliding endpoint digest', '1P', 'beta', '21', 'beta', 0, 0],
    ['leading zero', 'alpha', '01', 'alpha', '1', 0, 0],
    ['delimiters', 'a:b', 'c', 'a', 'b:c', 0, 0],
    ['direction', 'alpha', 'beta', 'beta', 'alpha', 0, 0],
    ['source slot', 'alpha', 'beta', 'alpha', 'beta', 1, 0],
    ['target slot', 'alpha', 'beta', 'alpha', 'beta', 0, 1]
  ])(
    'detects same-count scoped rewiring: %s',
    ([, source, target, nextSource, nextTarget, sourceSlot, targetSlot]) => {
      const graph = createMockLGraph({
        id: createGraph().id,
        isRootGraph: true,
        _nodes: [
          'alpha',
          'beta',
          'gamma',
          '1P',
          '21',
          '01',
          '1',
          'a:b',
          'c',
          'a',
          'b:c'
        ].map((id) => createMockLGraphNode({ id: toNodeId(id) }))
      })
      registerLink(graph, source, target)
      const reader = createReader(graph)
      reader.checkForChanges()
      registerLink(graph, nextSource, nextTarget, sourceSlot, targetSlot)
      expect(reader.checkForChanges()).toBe('picture')
      expect(reader.checkForChanges()).toBe('none')
    }
  )

  it('ignores foreign topology and missing endpoints, then detects drawable links', () => {
    const graph = createGraph()
    const reader = createReader(graph)
    reader.checkForChanges()
    registerLink(createMockLGraph({ id: 'other-root' }), '1', '2')
    expect(reader.checkForChanges()).toBe('none')
    registerLink(graph, '1', 'missing')
    expect(reader.checkForChanges()).toBe('none')
    registerLink(graph, '1', '2')
    expect(reader.checkForChanges()).toBe('picture')
    useLinkStore().clearGraph(graphScopeOf(graph).rootGraphId)
    expect(reader.checkForChanges()).toBe('picture')
  })

  it('isolates sibling subgraph topology under the same root', () => {
    const graph = createGraph(false)
    const sibling = createMockLGraph({
      id: 'sibling',
      rootGraph: graph.rootGraph,
      _nodes: graph._nodes
    })
    const reader = createReader(graph)
    reader.checkForChanges()
    registerLink(sibling, '1', '2')
    expect(reader.checkForChanges()).toBe('none')
  })

  it('invalidates subgraph geometry when only the root identity changes', () => {
    const graph = createMockLGraph({
      id: 'subgraph',
      isRootGraph: false,
      rootGraph: createGraph(),
      _nodes: createGraph()._nodes
    })
    const reader = createReader(graph)
    reader.checkForChanges()
    graph.rootGraph.id = 'new-root'
    expect(reader.checkForChanges()).toBe('geometry')
  })

  it('invalidates identical content on configuration completion', () => {
    const graph = createGraph()
    const reader = createReader(graph)
    reader.checkForChanges()
    graph.events.dispatch('configured')
    expect(reader.checkForChanges()).toBe('geometry')
    expect(reader.checkForChanges()).toBe('none')
  })

  it('does not modify graph callbacks or subscribe to ordinary hints', () => {
    const graph = createGraph()
    const callback = vi.fn()
    graph.onConnectionChange = callback
    const add = vi.spyOn(graph.events, 'addEventListener')
    const reader = createReader(graph)
    expect(add).toHaveBeenCalledExactlyOnceWith(
      'configured',
      expect.any(Function)
    )
    expect(graph.onConnectionChange).toBe(callback)
    reader.scope.stop()
    expect(graph.onConnectionChange).toBe(callback)
  })

  it('detaches null graphs and starts restored graphs with fresh geometry', async () => {
    const graph = createGraph()
    const remove = vi.spyOn(graph.events, 'removeEventListener')
    const reader = createReader(graph)
    reader.checkForChanges()
    reader.graph.value = null
    expect(reader.checkForChanges()).toBe('none')
    await nextTick()
    expect(remove).toHaveBeenCalledExactlyOnceWith(
      'configured',
      expect.any(Function)
    )
    graph.events.dispatch('configured')
    expect(reader.checkForChanges()).toBe('none')
    reader.graph.value = graph
    await nextTick()
    expect(reader.checkForChanges()).toBe('geometry')
  })

  it('isolates equally shaped replacements from old configuration events', async () => {
    const first = createGraph()
    const second = createGraph()
    const reader = createReader(first)
    reader.checkForChanges()
    reader.graph.value = second
    expect(reader.checkForChanges()).toBe('none')
    await nextTick()
    expect(reader.checkForChanges()).toBe('geometry')
    first.events.dispatch('configured')
    expect(reader.checkForChanges()).toBe('none')
    second.events.dispatch('configured')
    expect(reader.checkForChanges()).toBe('geometry')
  })

  it('resets scope identity after in-place ID changes and detaches that same graph', () => {
    const graph = createGraph()
    const add = vi.spyOn(graph.events, 'addEventListener')
    const remove = vi.spyOn(graph.events, 'removeEventListener')
    const reader = createReader(graph)
    reader.checkForChanges()
    graph.id = 'new-id'
    expect(reader.checkForChanges()).toBe('geometry')
    expect(add).toHaveBeenCalledTimes(1)
    reader.scope.stop()
    expect(remove).toHaveBeenCalledExactlyOnceWith(
      'configured',
      add.mock.calls[0][1]
    )
    graph.events.dispatch('configured')
    expect(reader.checkForChanges()).toBe('none')
  })

  it.for(['null', 'replacement'])(
    'detaches the captured graph when scope stops before queued %s watch',
    async (transition) => {
      const graph = createGraph()
      const replacement = createGraph()
      const add = vi.spyOn(graph.events, 'addEventListener')
      const remove = vi.spyOn(graph.events, 'removeEventListener')
      const replacementAdd = vi.spyOn(replacement.events, 'addEventListener')
      const reader = createReader(graph)
      reader.checkForChanges()
      reader.graph.value = transition === 'null' ? null : replacement
      reader.scope.stop()
      expect(remove).toHaveBeenCalledExactlyOnceWith(
        'configured',
        add.mock.calls[0][1]
      )
      graph.events.dispatch('configured')
      await nextTick()
      expect(replacementAdd).not.toHaveBeenCalled()
      expect(reader.checkForChanges()).toBe('none')
    }
  )

  it('handles an initially null graph without subscriptions', () => {
    const reader = createReader(null)
    expect(reader.checkForChanges()).toBe('none')
    reader.scope.stop()
    expect(reader.checkForChanges()).toBe('none')
  })
})
