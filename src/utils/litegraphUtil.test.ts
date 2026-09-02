import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import {
  createNode,
  getWidgetIdForNode,
  mapLiveWidgetsById,
  migrateWidgetsValues,
  resolveNode
} from './litegraphUtil'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

const mockBringNodeToFront = vi.fn()

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeZIndex', () => ({
  useNodeZIndex: () => ({ bringNodeToFront: mockBringNodeToFront })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: vi.fn() })
}))

describe('resolveNode', () => {
  it('returns undefined when graph is null', () => {
    expect(resolveNode(1, null)).toBeUndefined()
  })

  it('returns undefined when graph is undefined', () => {
    expect(resolveNode(1, undefined)).toBeUndefined()
  })

  it('finds a node in the root graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    graph.add(node)

    expect(resolveNode(node.id, graph)).toBe(node)
  })

  it('returns undefined when node does not exist anywhere', () => {
    const graph = new LGraph()

    expect(resolveNode(999, graph)).toBeUndefined()
  })

  it('finds a node inside a subgraph', () => {
    const subgraph = createTestSubgraph({ nodeCount: 1 })
    const rootGraph = subgraph.rootGraph
    rootGraph._subgraphs.set(subgraph.id, subgraph)
    const subgraphNode = subgraph._nodes[0]

    // Node should NOT be found directly on root graph
    expect(rootGraph.getNodeById(subgraphNode.id)).toBeFalsy()

    // But resolveNode should find it via subgraph search
    expect(resolveNode(subgraphNode.id, rootGraph)).toBe(subgraphNode)
  })

  it('prefers root graph node over subgraph node with same id', () => {
    const subgraph = createTestSubgraph()
    const rootGraph = subgraph.rootGraph

    const rootNode = new LGraphNode('RootNode')
    rootGraph.add(rootNode)

    // Add a different node to the subgraph
    const sgNode = new LGraphNode('SubgraphNode')
    subgraph.add(sgNode)

    // resolveNode should return the root graph node first
    expect(resolveNode(rootNode.id, rootGraph)).toBe(rootNode)
  })

  it('searches across multiple subgraphs', () => {
    const sg1 = createTestSubgraph({ name: 'SG1' })
    const rootGraph = sg1.rootGraph
    const sg2 = createTestSubgraph({ name: 'SG2', nodeCount: 1 })

    // Put sg2 under the same root graph
    rootGraph._subgraphs.set(sg2.id, sg2)

    const targetNode = sg2._nodes[0]
    expect(resolveNode(targetNode.id, rootGraph)).toBe(targetNode)
  })
})

describe('createNode', () => {
  function makeCanvas(graph: LGraph): LGraphCanvas {
    return fromPartial<LGraphCanvas>({
      graph,
      graph_mouse: [100, 200]
    })
  }

  it('returns null when name is empty', async () => {
    const result = await createNode(makeCanvas(new LGraph()), '')
    expect(result).toBeNull()
    expect(mockBringNodeToFront).not.toHaveBeenCalled()
  })

  it('places the new node at the canvas graph_mouse position', async () => {
    const newNode = new LGraphNode('LoadImage')
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(newNode)
    const graph = new LGraph()

    const result = await createNode(makeCanvas(graph), 'LoadImage')

    expect(result).toBe(newNode)
    expect(Array.from(newNode.pos)).toEqual([100, 200])
    spy.mockRestore()
  })

  it('brings the new node to front so it renders above existing nodes', async () => {
    const newNode = new LGraphNode('LoadImage')
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(newNode)
    const graph = new LGraph()

    const result = await createNode(makeCanvas(graph), 'LoadImage')

    expect(result).toBe(newNode)
    expect(mockBringNodeToFront).toHaveBeenCalledTimes(1)
    expect(mockBringNodeToFront).toHaveBeenCalledWith(newNode.id)
    spy.mockRestore()
  })

  it('does not bring node to front when LiteGraph.createNode returns null', async () => {
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(null)
    await createNode(makeCanvas(new LGraph()), 'NonexistentNode')
    expect(mockBringNodeToFront).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('does not bring node to front when graph.add returns null', async () => {
    const newNode = new LGraphNode('LoadImage')
    const spy = vi.spyOn(LiteGraph, 'createNode').mockReturnValue(newNode)
    const graph = new LGraph()
    vi.spyOn(graph, 'add').mockReturnValue(fromAny<LGraphNode, null>(null))

    await createNode(makeCanvas(graph), 'LoadImage')

    expect(mockBringNodeToFront).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('getWidgetIdForNode', () => {
  const graphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  function fakeNode(id: number, opts: { detached?: boolean } = {}): LGraphNode {
    return createMockLGraphNode({
      id,
      graph: opts.detached ? undefined : { rootGraph: { id: graphId } }
    })
  }

  it('returns widget.widgetId when present', () => {
    const node = fakeNode(7)
    const existingWidgetId = widgetId(graphId, toNodeId(7), 'seed')
    const widget = {
      name: 'seed',
      widgetId: existingWidgetId
    }
    expect(getWidgetIdForNode(node, widget)).toBe(existingWidgetId)
  })

  it('derives an widgetId for plain POJO widgets bound to a node', () => {
    const node = fakeNode(42)
    expect(getWidgetIdForNode(node, { name: 'legacy_widget' })).toBe(
      widgetId(graphId, toNodeId(42), 'legacy_widget')
    )
  })

  it('distinguishes duplicate names across widget types', () => {
    const node = fakeNode(42)
    node.widgets = [
      { name: 'shared', type: 'number', value: 1, options: {}, y: 0 },
      { name: 'shared', type: 'text', value: 'two', options: {}, y: 0 }
    ]

    const widgetsById = mapLiveWidgetsById(node)
    expect(widgetsById.get(widgetId(graphId, toNodeId(42), 'shared'))).toBe(
      node.widgets[0]
    )
    expect(widgetsById.get(widgetId(graphId, toNodeId(42), 'shared#1'))).toBe(
      node.widgets[1]
    )
    expect(node.widgets.map(({ name }) => name)).toEqual(['shared', 'shared#1'])
  })

  it('avoids collisions with literal duplicate suffixes', () => {
    const node = fakeNode(42)
    node.widgets = [
      { name: 'shared', type: 'number', value: 1, options: {}, y: 0 },
      { name: 'shared', type: 'number', value: 2, options: {}, y: 0 },
      { name: 'shared#1', type: 'number', value: 3, options: {}, y: 0 }
    ]

    const widgetsById = mapLiveWidgetsById(node)
    expect(widgetsById.get(widgetId(graphId, toNodeId(42), 'shared'))).toBe(
      node.widgets[0]
    )
    expect(widgetsById.get(widgetId(graphId, toNodeId(42), 'shared#2'))).toBe(
      node.widgets[1]
    )
    expect(widgetsById.get(widgetId(graphId, toNodeId(42), 'shared#1'))).toBe(
      node.widgets[2]
    )
    expect(getWidgetIdForNode(node, node.widgets[1])).toBe(
      widgetId(graphId, toNodeId(42), 'shared#2')
    )
    expect(node.widgets.map(({ name }) => name)).toEqual([
      'shared',
      'shared#2',
      'shared#1'
    ])
  })

  it('maps every widget when one duplicate cannot be renamed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = fakeNode(42)
    const first = {
      name: 'shared',
      type: 'number',
      value: 1,
      options: {},
      y: 0
    }
    const frozen = Object.freeze({
      name: 'shared',
      type: 'number',
      value: 2,
      options: {},
      y: 0
    })
    node.widgets = [first, frozen]

    const mapped = mapLiveWidgetsById(node)
    expect([...mapped.keys()]).toEqual([
      widgetId(graphId, toNodeId(42), 'shared'),
      widgetId(graphId, toNodeId(42), 'shared#1')
    ])
    const [mappedFirst, mappedFrozen] = mapped.values()
    expect(mappedFirst).toBe(first)
    expect(mappedFrozen).toBe(frozen)
    expect(node.widgets.map(({ name }) => name)).toEqual(['shared', 'shared'])
    expect(warn).toHaveBeenCalledOnce()
    warn.mockClear()
    expect(getWidgetIdForNode(node, frozen)).toBe(
      widgetId(graphId, toNodeId(42), 'shared#1')
    )
    expect(warn).toHaveBeenCalledOnce()
  })

  it('maps repeated widget object references only once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = fakeNode(42)
    const first = {
      name: 'shared',
      type: 'number',
      value: 1,
      options: {},
      y: 0
    }
    const frozen = Object.freeze({
      name: 'shared',
      type: 'number',
      value: 2,
      options: {},
      y: 0
    })
    node.widgets = [first, first, frozen]

    const mapped = mapLiveWidgetsById(node)

    expect([...mapped.keys()]).toEqual([
      widgetId(graphId, toNodeId(42), 'shared'),
      widgetId(graphId, toNodeId(42), 'shared#1')
    ])
    const [mappedFirst, mappedFrozen] = mapped.values()
    expect(mappedFirst).toBe(first)
    expect(mappedFrozen).toBe(frozen)
    expect(node.widgets.map(({ name }) => name)).toEqual([
      'shared',
      'shared',
      'shared'
    ])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('returns undefined when the node has no graph', () => {
    const node = fakeNode(1, { detached: true })
    expect(getWidgetIdForNode(node, { name: 'x' })).toBeUndefined()
  })

  it('returns undefined for placeholder node id (-1)', () => {
    const node = fakeNode(-1)
    expect(getWidgetIdForNode(node, { name: 'x' })).toBeUndefined()
  })
})

describe('migrateWidgetsValues', () => {
  const inputDefs = {
    forced: fromPartial<InputSpec>({ name: 'forced', forceInput: true }),
    preview: fromPartial<InputSpec>({ name: 'preview' }),
    steps: fromPartial<InputSpec>({ name: 'steps' })
  }

  function makeWidget(name: string, serialize = true): IBaseWidget {
    return fromPartial<IBaseWidget>({ name, serialize })
  }

  it('migrates a legacy force-input array with a trailing skipped widget', () => {
    const widgets = [makeWidget('steps'), makeWidget('preview', false)]

    expect(migrateWidgetsValues(inputDefs, widgets, [1, 20])).toEqual([20])
  })

  it('compacts a mid-list hole with a trailing skipped widget', () => {
    const holeInputDefs = {
      a: fromPartial<InputSpec>({ name: 'a' }),
      ui1: fromPartial<InputSpec>({ name: 'ui1' }),
      b: fromPartial<InputSpec>({ name: 'b' }),
      ui2: fromPartial<InputSpec>({ name: 'ui2' })
    }
    const widgets = [
      makeWidget('a'),
      makeWidget('ui1', false),
      makeWidget('b'),
      makeWidget('ui2', false)
    ]

    expect(
      migrateWidgetsValues(holeInputDefs, widgets, ['av', null, 'bv'])
    ).toEqual(['av', 'bv'])
  })

  it('migrates a sparse value array with a non-trailing skipped widget', () => {
    const widgets = [makeWidget('preview', false), makeWidget('steps')]

    expect(migrateWidgetsValues(inputDefs, widgets, [1, null, 20])).toEqual([
      20
    ])
  })

  it('continues to migrate a value array without skipped widgets', () => {
    const widgets = [makeWidget('steps')]

    expect(migrateWidgetsValues(inputDefs, widgets, [1, 20])).toEqual([20])
  })
})
