import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import type {
  IBaseWidget,
  IComboWidget
} from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import {
  addToComboValues,
  compressWidgetInputSlots,
  createNode,
  executeWidgetsCallback,
  getItemsColorOption,
  getLinkTypeColor,
  getWidgetIdForNode,
  isAnimatedOutput,
  isAudioNode,
  isImageNode,
  isLoad3dNode,
  isVideoNode,
  isVideoOutput,
  migrateWidgetsValues,
  resolveComboValues,
  resolveNode,
  resolveNodeWidget
} from './litegraphUtil'

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

  beforeEach(() => {
    mockBringNodeToFront.mockClear()
  })

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

  it('can distinguish duplicate widget names on one node without changing the displayed name', () => {
    const node = fakeNode(42)
    expect(getWidgetIdForNode(node, { name: 'UNKNOWN' }, 1)).toBe(
      widgetId(graphId, toNodeId(42), 'UNKNOWN#1')
    )
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

describe('media helpers', () => {
  it('classifies preview media nodes', () => {
    expect(isImageNode(undefined)).toBe(false)
    expect(isVideoNode(undefined)).toBe(false)
    expect(isAudioNode(undefined)).toBe(false)

    const imageNode = new LGraphNode('Image')
    imageNode.previewMediaType = 'image'
    const imageWithImgs = Object.assign(new LGraphNode('Image'), {
      previewMediaType: 'model' as const,
      imgs: [document.createElement('img')]
    })
    const videoWithImgs = Object.assign(new LGraphNode('Video'), {
      previewMediaType: 'video' as const,
      imgs: [document.createElement('img')]
    })
    const videoNode = new LGraphNode('Video')
    videoNode.previewMediaType = 'video'
    const videoContainerNode = Object.assign(new LGraphNode('Video'), {
      videoContainer: document.body
    })
    const audioNode = new LGraphNode('Audio')
    audioNode.previewMediaType = 'audio'

    expect(isImageNode(imageNode)).toBe(true)
    expect(isImageNode(imageWithImgs)).toBe(true)
    expect(isImageNode(videoWithImgs)).toBe(false)
    expect(isVideoNode(videoNode)).toBe(true)
    expect(isVideoNode(videoContainerNode)).toBe(true)
    expect(isAudioNode(audioNode)).toBe(true)
  })

  it('distinguishes animated images from video outputs', () => {
    expect(isAnimatedOutput(undefined)).toBe(false)
    expect(isAnimatedOutput({ animated: [false, true] })).toBe(true)
    expect(
      isVideoOutput({
        animated: [true],
        images: [{ filename: 'clip.mp4' }]
      })
    ).toBe(true)
    expect(
      isVideoOutput({
        animated: [true],
        images: [{ filename: 'preview.webp' }]
      })
    ).toBe(false)
    expect(
      isVideoOutput({
        animated: [true],
        images: [{ filename: 'preview.png' }]
      })
    ).toBe(false)
  })

  it('detects 3d loader nodes', () => {
    const modelNode = new LGraphNode('Load3D')
    modelNode.type = 'Load3D'
    const animationNode = new LGraphNode('Load3DAnimation')
    animationNode.type = 'Load3DAnimation'
    const imageNode = new LGraphNode('LoadImage')
    imageNode.type = 'LoadImage'

    expect(isLoad3dNode(modelNode)).toBe(true)
    expect(isLoad3dNode(animationNode)).toBe(true)
    expect(isLoad3dNode(imageNode)).toBe(false)
  })
})

describe('combo widget helpers', () => {
  function combo(values: IComboWidget['options']['values']): IComboWidget {
    return fromPartial<IComboWidget>({
      name: 'mode',
      type: 'combo',
      value: 'a',
      options: { values }
    })
  }

  it('resolves combo values from arrays, records, functions, and missing options', () => {
    expect(resolveComboValues(combo(['a', 'b']))).toEqual(['a', 'b'])
    expect(resolveComboValues(combo({ a: 'A', b: 'B' }))).toEqual(['a', 'b'])
    expect(resolveComboValues(combo(() => ['x']))).toEqual(['x'])
    expect(
      resolveComboValues(fromPartial<IComboWidget>({ options: {} }))
    ).toEqual([])
  })

  it('adds only missing array combo values', () => {
    const widget = combo(['a'])

    addToComboValues(widget, 'b')
    addToComboValues(widget, 'b')

    expect(widget.options.values).toEqual(['a', 'b'])
  })
})

describe('node utility helpers', () => {
  it('returns a shared color option only when all colorable items match', () => {
    const red = { getColorOption: () => 'red', setColorOption: vi.fn() }
    const redAgain = { getColorOption: () => 'red', setColorOption: vi.fn() }
    const blue = { getColorOption: () => 'blue', setColorOption: vi.fn() }

    expect(getItemsColorOption([red, redAgain, {}])).toBe('red')
    expect(getItemsColorOption([red, blue])).toBeNull()
    expect(getItemsColorOption([{}])).toBeNull()
  })

  it('executes matching callbacks on node widgets', () => {
    const onRemove = vi.fn()
    const afterQueued = vi.fn()
    const node = new LGraphNode('Callbacks')
    node.widgets = [
      fromPartial<IBaseWidget>({ onRemove }),
      fromPartial<IBaseWidget>({ afterQueued })
    ]

    executeWidgetsCallback([node], 'onRemove')

    expect(onRemove).toHaveBeenCalledOnce()
    expect(afterQueued).not.toHaveBeenCalled()
  })

  it('returns configured link colors with the default fallback', () => {
    expect(getLinkTypeColor('missing-type')).toBe(LiteGraph.LINK_COLOR)
  })
})

describe('legacy workflow migration helpers', () => {
  it('drops legacy force-input widget values only when lengths match', () => {
    const inputDefs = {
      seed: { name: 'seed', type: 'INT', forceInput: true },
      mode: { name: 'mode', type: 'STRING' },
      batch: {
        name: 'batch',
        type: 'INT',
        control_after_generate: true
      }
    }
    const widgets = [
      fromPartial<IBaseWidget>({ name: 'mode' }),
      fromPartial<IBaseWidget>({ name: 'batch' })
    ]

    expect(migrateWidgetsValues(inputDefs, widgets, [1, 2, 3, 4])).toEqual([
      2, 3, 4
    ])
    expect(migrateWidgetsValues(inputDefs, widgets, [1, 2])).toEqual([1, 2])
  })

  it('compresses root and subgraph widget input slots', () => {
    const graph = fromPartial<ISerialisedGraph>({
      nodes: [
        {
          id: 1,
          type: 'Node',
          inputs: [
            {
              name: 'widget',
              type: 'STRING',
              link: null,
              widget: { name: 'w' }
            },
            { name: 'kept', type: 'STRING', link: 7 }
          ]
        }
      ],
      links: [[7, 2, 0, 1, 99, 'STRING']],
      definitions: {
        subgraphs: [
          {
            name: 'Subgraph',
            nodes: [
              {
                id: 3,
                type: 'Inner',
                inputs: [
                  {
                    name: 'legacy',
                    type: 'STRING',
                    link: null,
                    widget: { name: 'legacy' }
                  },
                  { name: 'inner', type: 'STRING', link: 8 }
                ]
              }
            ],
            links: [
              {
                id: 8,
                origin_id: 4,
                origin_slot: 0,
                target_id: 3,
                target_slot: 42,
                type: 'STRING'
              }
            ]
          }
        ]
      }
    })

    compressWidgetInputSlots(graph)

    expect(graph.nodes[0].inputs?.map((input) => input.name)).toEqual(['kept'])
    expect(graph.links[0][4]).toBe(0)
    const subgraph = graph.definitions?.subgraphs?.[0]
    expect(subgraph?.nodes?.[0].inputs?.map((input) => input.name)).toEqual([
      'inner'
    ])
    expect(subgraph?.links?.[0].target_slot).toBe(0)
  })
})

describe('resolveNodeWidget', () => {
  it('resolves root graph nodes and widgets', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    const widget = node.addWidget('text', 'prompt', 'hello', () => {})
    graph.add(node)

    expect(resolveNodeWidget(node.id, undefined, graph)).toEqual([node])
    expect(resolveNodeWidget(node.id, 'prompt', graph)).toEqual([node, widget])
    expect(resolveNodeWidget(node.id, 'missing', graph)).toEqual([])
    expect(resolveNodeWidget('not-a-node-id', 'prompt', graph)).toEqual([])
  })
})
