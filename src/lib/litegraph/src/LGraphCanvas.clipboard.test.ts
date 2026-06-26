import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import { autoExposeKnownPreviewNodes } from '@/core/graph/subgraph/promotionUtils'
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
import { toNodeId } from '@/types/nodeId'
import type {
  ClipboardItems,
  ExportedSubgraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

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
    existingNode.id = toNodeId(1)
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
        id: SUBGRAPH_INPUT_ID,
        bounding: [0, 0, 10, 10]
      },
      outputNode: {
        id: SUBGRAPH_OUTPUT_ID,
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
    existingNode.id = toNodeId(1)
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
      inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 10, 10] },
      outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 10, 10] },
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

describe('_deserializeItems paste-time migration & auto-expose', () => {
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

  function registerSubgraphNodeTypeOnCreate(rootGraph: LGraph): void {
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
  }

  function createCanvas(graph: LGraph): LGraphCanvas {
    const el = document.createElement('canvas')
    el.width = 800
    el.height = 600
    el.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    el.getBoundingClientRect = vi
      .fn()
      .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
    return new LGraphCanvas(el, graph, { skip_render: true })
  }

  function registerClipboardNodeType(type: string): void {
    class ClipboardNode extends LGraphNode {
      constructor() {
        super('Clipboard Node')
        this.addInput('input', '*')
        this.addOutput('output', '*')
      }
    }
    LiteGraph.registerNodeType(type, ClipboardNode)
    registeredTypesToCleanup.push(type)
  }

  it('reconnects pasted inputs when clipboard node IDs differ from link endpoint types', () => {
    const nodeType = 'test/clipboard-node-id-normalization'
    registerClipboardNodeType(nodeType)

    const rootGraph = new LGraph()
    const canvas = createCanvas(rootGraph)

    const source = LiteGraph.createNode(nodeType)!
    source.id = toNodeId(1)
    rootGraph.add(source)

    const target = LiteGraph.createNode(nodeType)!
    target.id = toNodeId(2)
    rootGraph.add(target)
    source.connect(0, target, 0)

    const copied = canvas._serializeItems([target])
    expect(copied.nodes?.[0]?.id).toBe(2)
    expect(copied.links?.[0]?.origin_id).toBe(1)
    expect(copied.links?.[0]?.target_id).toBe(2)

    const copiedTarget = copied.nodes?.[0]
    if (!copiedTarget) throw new Error('Expected copied target node')
    copiedTarget.id = '2'

    const result = canvas._deserializeItems(copied, {
      connectInputs: true,
      position: [300, 300]
    })

    const pastedTarget = result?.nodes.get(2)
    if (!pastedTarget) throw new Error('Expected pasted target node')

    const pastedInputLinkId = pastedTarget.inputs[0].link
    expect(pastedInputLinkId).not.toBeNull()

    if (pastedInputLinkId == null) {
      throw new Error('Expected pasted input link')
    }

    const pastedInputLink = rootGraph._links.get(pastedInputLinkId)
    expect(pastedInputLink?.origin_id).toBe(source.id)
    expect(pastedInputLink?.target_id).toBe(pastedTarget.id)
  })

  it('clears legacy proxyWidgets on a pasted SubgraphNode and applies host widget values', () => {
    LGraph.proxyWidgetMigrationFlush = (hostNode, nodeData) =>
      flushProxyWidgetMigration({
        hostNode,
        hostWidgetValues: nodeData?.widgets_values
      })

    const rootGraph = new LGraph()
    registerSubgraphNodeTypeOnCreate(rootGraph)
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
      inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 10, 10] },
      outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 10, 10] },
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

    const pastedHosts = rootGraph.nodes.filter(
      (n): n is SubgraphNode => n instanceof SubgraphNode
    )
    expect(pastedHosts).toHaveLength(1)
    expect(pastedHosts[0].properties.proxyWidgets).toBeUndefined()
  })

  it('auto-exposes preview nodes for pasted subgraphs that lack previewExposures', () => {
    LGraph.autoExposePreviewNodes = (hostNode) =>
      autoExposeKnownPreviewNodes(hostNode)

    const rootGraph = new LGraph()
    registerSubgraphNodeTypeOnCreate(rootGraph)
    const canvas = createCanvas(rootGraph)

    const subgraphId = createUuidv4()
    const interiorPreviewId = 5
    const pastedSubgraph: ExportedSubgraph = {
      id: subgraphId,
      version: 1,
      revision: 0,
      state: {
        lastNodeId: interiorPreviewId,
        lastLinkId: 0,
        lastGroupId: 0,
        lastRerouteId: 0
      },
      config: {},
      name: 'Pasted Subgraph',
      inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 10, 10] },
      outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 10, 10] },
      inputs: [],
      outputs: [],
      widgets: [],
      nodes: [
        {
          id: interiorPreviewId,
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

    const pastedHost = rootGraph.nodes.find(
      (n): n is SubgraphNode => n instanceof SubgraphNode
    )
    expect(pastedHost).toBeDefined()

    const exposures = usePreviewExposureStore().getExposures(
      rootGraph.id,
      String(pastedHost!.id)
    )
    const interiorIdAfterRemap = pastedHost!.subgraph.nodes[0].id
    expect(exposures).toEqual([
      expect.objectContaining({
        sourceNodeId: String(interiorIdAfterRemap),
        sourcePreviewName: '$$canvas-image-preview'
      })
    ])
  })
})
