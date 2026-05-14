import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph,
  SubgraphNode,
  createUuidv4
} from '@/lib/litegraph/src/litegraph'
import { remapClipboardSubgraphNodeIds } from '@/lib/litegraph/src/LGraphCanvas'
import type {
  ClipboardItems,
  ExportedSubgraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

function createSerialisedNode(
  id: number,
  type: string,
  proxyWidgets?: Array<[string, string]>
): ISerialisedNode {
  return {
    id,
    type,
    pos: [0, 0],
    size: [140, 80],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [],
    outputs: [],
    properties: proxyWidgets ? { proxyWidgets } : {}
  }
}

describe('remapClipboardSubgraphNodeIds', () => {
  it('remaps pasted subgraph interior IDs and proxyWidgets references', () => {
    const rootGraph = new LGraph()
    const existingNode = new LGraphNode('existing')
    existingNode.id = 1
    rootGraph.add(existingNode)

    const subgraphId = createUuidv4()
    const pastedSubgraph: ExportedSubgraph = {
      id: subgraphId,
      version: 1,
      revision: 0,
      state: {
        lastNodeId: 0,
        lastLinkId: 0,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      config: {},
      name: 'Pasted Subgraph',
      inputNode: {
        id: -10,
        bounding: [0, 0, 10, 10]
      },
      outputNode: {
        id: -20,
        bounding: [0, 0, 10, 10]
      },
      inputs: [],
      outputs: [],
      widgets: [],
      nodes: [createSerialisedNode(1, 'test/node')],
      links: [
        {
          id: 1,
          type: '*',
          origin_id: 1,
          origin_slot: 0,
          target_id: 1,
          target_slot: 0
        }
      ],
      groups: []
    }

    const parsed: ClipboardItems = {
      nodes: [createSerialisedNode(99, subgraphId, [['1', 'seed']])],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: [pastedSubgraph]
    }

    remapClipboardSubgraphNodeIds(parsed, rootGraph)

    const remappedSubgraph = parsed.subgraphs?.[0]
    expect(remappedSubgraph).toBeDefined()

    const remappedLink = remappedSubgraph?.links?.[0]
    expect(remappedLink).toBeDefined()

    const remappedInteriorId = remappedSubgraph?.nodes?.[0]?.id
    expect(remappedInteriorId).not.toBe(1)
    expect(remappedLink?.origin_id).toBe(remappedInteriorId)
    expect(remappedLink?.target_id).toBe(remappedInteriorId)

    const remappedNode = parsed.nodes?.[0]
    expect(remappedNode).toBeDefined()
    expect(remappedNode?.properties?.proxyWidgets).toStrictEqual([
      [String(remappedInteriorId), 'seed']
    ])
  })

  it('remaps pasted SubgraphNode previewExposures sourceNodeId references', () => {
    const rootGraph = new LGraph()
    const existingNode = new LGraphNode('existing')
    existingNode.id = 1
    rootGraph.add(existingNode)

    const subgraphId = createUuidv4()
    const pastedSubgraph: ExportedSubgraph = {
      id: subgraphId,
      version: 1,
      revision: 0,
      state: {
        lastNodeId: 0,
        lastLinkId: 0,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      config: {},
      name: 'Pasted Subgraph',
      inputNode: { id: -10, bounding: [0, 0, 10, 10] },
      outputNode: { id: -20, bounding: [0, 0, 10, 10] },
      inputs: [],
      outputs: [],
      widgets: [],
      nodes: [createSerialisedNode(1, 'test/node')],
      links: [],
      groups: []
    }

    const hostInfo = createSerialisedNode(99, subgraphId)
    hostInfo.properties = {
      previewExposures: [
        {
          name: '$$canvas-image-preview',
          sourceNodeId: '1',
          sourcePreviewName: '$$canvas-image-preview'
        }
      ]
    }

    const parsed: ClipboardItems = {
      nodes: [hostInfo],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: [pastedSubgraph]
    }

    remapClipboardSubgraphNodeIds(parsed, rootGraph)

    const remappedInteriorId = parsed.subgraphs?.[0]?.nodes?.[0]?.id
    expect(remappedInteriorId).not.toBe(1)
    expect(parsed.nodes?.[0]?.properties?.previewExposures).toStrictEqual([
      {
        name: '$$canvas-image-preview',
        sourceNodeId: String(remappedInteriorId),
        sourcePreviewName: '$$canvas-image-preview'
      }
    ])
  })
})

describe('_deserializeItems proxyWidgets migration', () => {
  let originalFlush: typeof LGraph.proxyWidgetMigrationFlush
  let originalAutoExpose: typeof LGraph.autoExposePreviewNodes
  const registeredTypesToCleanup: string[] = []

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    originalFlush = LGraph.proxyWidgetMigrationFlush
    originalAutoExpose = LGraph.autoExposePreviewNodes
  })

  afterEach(() => {
    LGraph.proxyWidgetMigrationFlush = originalFlush
    LGraph.autoExposePreviewNodes = originalAutoExpose
    for (const type of registeredTypesToCleanup) {
      LiteGraph.unregisterNodeType(type)
    }
    registeredTypesToCleanup.length = 0
  })

  function createCanvas(graph: LGraph): LGraphCanvas {
    const el = document.createElement('canvas')
    el.width = 800
    el.height = 600
    el.getContext = vi.fn().mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      getTransform: vi
        .fn()
        .mockReturnValue({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      beginPath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      clip: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn()
    } as unknown as CanvasRenderingContext2D)
    el.getBoundingClientRect = vi
      .fn()
      .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
    return new LGraphCanvas(el, graph, { skip_render: true })
  }

  it('invokes the migration hook for top-level pasted SubgraphNodes carrying legacy proxyWidgets', () => {
    const flush = vi.fn()
    LGraph.proxyWidgetMigrationFlush = flush

    const rootGraph = new LGraph()
    rootGraph.events.addEventListener('subgraph-created', (e) => {
      const { subgraph } = e.detail
      class TestSubgraphNode extends SubgraphNode {
        constructor() {
          super(rootGraph, subgraph as Subgraph, {
            id: -1,
            type: subgraph.id,
            pos: [0, 0],
            size: [100, 100],
            inputs: [],
            outputs: [],
            flags: {},
            order: 0,
            mode: 0
          })
        }
      }
      LiteGraph.registerNodeType(subgraph.id, TestSubgraphNode)
      registeredTypesToCleanup.push(subgraph.id)
    })
    const canvas = createCanvas(rootGraph)

    const subgraphId = createUuidv4()
    const interiorId = 7
    const pastedSubgraph: ExportedSubgraph = {
      id: subgraphId,
      version: 1,
      revision: 0,
      state: {
        lastNodeId: interiorId,
        lastLinkId: 0,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      config: {},
      name: 'Pasted Subgraph',
      inputNode: { id: -10, bounding: [0, 0, 10, 10] },
      outputNode: { id: -20, bounding: [0, 0, 10, 10] },
      inputs: [],
      outputs: [],
      widgets: [],
      nodes: [
        {
          id: interiorId,
          type: 'test/inner',
          pos: [0, 0],
          size: [140, 80],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [],
          outputs: [],
          properties: {}
        }
      ],
      links: [],
      groups: []
    }

    const hostInfo: ISerialisedNode = {
      id: 99,
      type: subgraphId,
      pos: [0, 0],
      size: [140, 80],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: { proxyWidgets: [[String(interiorId), 'seed']] },
      widgets_values: [42]
    }

    const parsed: ClipboardItems = {
      nodes: [hostInfo],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: [pastedSubgraph]
    }

    canvas._deserializeItems(parsed, {})

    expect(flush).toHaveBeenCalledTimes(1)
    const [hostNode, infoArg] = flush.mock.calls[0]
    expect(hostNode).toBeInstanceOf(SubgraphNode)
    expect(infoArg?.widgets_values).toStrictEqual([42])
  })

  it('does not invoke the migration hook for plain pasted nodes', () => {
    const flush = vi.fn()
    LGraph.proxyWidgetMigrationFlush = flush

    const rootGraph = new LGraph()
    const canvas = createCanvas(rootGraph)

    const parsed: ClipboardItems = {
      nodes: [
        {
          id: 1,
          type: 'test/plain',
          pos: [0, 0],
          size: [140, 80],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [],
          outputs: [],
          properties: {}
        }
      ],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: []
    }

    canvas._deserializeItems(parsed, {})

    expect(flush).not.toHaveBeenCalled()
  })

  it('invokes the auto-expose hook for every pasted SubgraphNode (older clipboard data without previewExposures)', () => {
    const autoExpose = vi.fn()
    LGraph.autoExposePreviewNodes = autoExpose

    const rootGraph = new LGraph()
    rootGraph.events.addEventListener('subgraph-created', (e) => {
      const { subgraph } = e.detail
      class TestSubgraphNode extends SubgraphNode {
        constructor() {
          super(rootGraph, subgraph as Subgraph, {
            id: -1,
            type: subgraph.id,
            pos: [0, 0],
            size: [100, 100],
            inputs: [],
            outputs: [],
            flags: {},
            order: 0,
            mode: 0
          })
        }
      }
      LiteGraph.registerNodeType(subgraph.id, TestSubgraphNode)
      registeredTypesToCleanup.push(subgraph.id)
    })
    const canvas = createCanvas(rootGraph)

    const subgraphId = createUuidv4()
    const pastedSubgraph: ExportedSubgraph = {
      id: subgraphId,
      version: 1,
      revision: 0,
      state: {
        lastNodeId: 5,
        lastLinkId: 0,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      config: {},
      name: 'Pasted Subgraph',
      inputNode: { id: -10, bounding: [0, 0, 10, 10] },
      outputNode: { id: -20, bounding: [0, 0, 10, 10] },
      inputs: [],
      outputs: [],
      widgets: [],
      nodes: [
        {
          id: 5,
          type: 'PreviewImage',
          pos: [0, 0],
          size: [140, 80],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [],
          outputs: [],
          properties: {}
        }
      ],
      links: [],
      groups: []
    }

    const hostInfo: ISerialisedNode = {
      id: 99,
      type: subgraphId,
      pos: [0, 0],
      size: [140, 80],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {}
    }

    const parsed: ClipboardItems = {
      nodes: [hostInfo],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: [pastedSubgraph]
    }

    canvas._deserializeItems(parsed, {})

    expect(autoExpose).toHaveBeenCalledTimes(1)
    expect(autoExpose.mock.calls[0][0]).toBeInstanceOf(SubgraphNode)
  })
})
