import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigration'
import { autoExposeKnownPreviewNodes } from '@/core/graph/subgraph/promotionUtils'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  createTestRootGraph,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
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
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toRerouteId } from '@/types/rerouteId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/services/litegraphService'))

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

function createSubgraphClipboardItems(interiorNodeId: number): ClipboardItems {
  return {
    nodes: [],
    groups: [],
    reroutes: [],
    links: [],
    subgraphs: [
      {
        id: createUuidv4(),
        version: 1,
        revision: 0,
        state: {
          lastNodeId: 0,
          lastLinkId: 0,
          lastGroupId: 0,
          lastRerouteId: 0
        },
        name: 'Pasted Subgraph',
        inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 10, 10] },
        outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 10, 10] },
        nodes: [createSerialisedNode(interiorNodeId, 'test/node')]
      }
    ]
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

  it('remaps collisions above the former fixed limit', () => {
    const rootGraph = new LGraph()
    const existingNode = new LGraphNode('existing')
    existingNode.id = toNodeId(1)
    rootGraph.add(existingNode)
    rootGraph.state.lastNodeId = 100_000_000
    const parsed = createSubgraphClipboardItems(1)

    remapClipboardSubgraphNodeIds(parsed, rootGraph)

    expect(parsed.subgraphs?.[0].nodes?.[0].id).toBe(100_000_001)
    expect(rootGraph.state.lastNodeId).toBe(100_000_001)
  })

  it('closes change tracking and preserves counters when remapping fails', () => {
    const rootGraph = new LGraph()
    const existingNode = new LGraphNode('existing')
    existingNode.id = toNodeId(1)
    rootGraph.add(existingNode)
    rootGraph.state.lastNodeId = Number.MAX_SAFE_INTEGER
    const canvas = createCanvas(rootGraph)
    const afterGraphChange = vi.spyOn(rootGraph, 'afterChange')
    const afterCanvasChange = vi.spyOn(canvas, 'emitAfterChange')
    const parsed = createSubgraphClipboardItems(1)

    expect(() => canvas._deserializeItems(parsed, {})).toThrow(
      'ID space exhausted'
    )
    expect(rootGraph.state.lastNodeId).toBe(Number.MAX_SAFE_INTEGER)
    expect(afterGraphChange).toHaveBeenCalledOnce()
    expect(afterCanvasChange).toHaveBeenCalledOnce()
  })
})

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600
  el.getContext = vi.fn().mockReturnValue(createMockCanvasRenderingContext2D())
  el.getBoundingClientRect = vi
    .fn()
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
  return new LGraphCanvas(el, graph, { skip_render: true, skip_events: true })
}

describe('link presentation transfer across recreation flows', () => {
  it.for([
    {
      name: 'valid',
      presentation: { hidden: true, label: 'Copied' },
      expected: { hidden: true, label: 'Copied' }
    },
    { name: 'absent', presentation: undefined, expected: undefined }
  ])(
    'preserves $name presentation through clipboard copy and paste',
    ({ presentation, expected }) => {
      const rootGraph = createTestRootGraph()
      const origin = createTestNode(rootGraph, [], ['number'])
      const target = createTestNode(rootGraph, ['number'])
      const link = origin.connect(0, target, 0)
      if (!link) throw new Error('Failed to connect clipboard test link')
      if (presentation) {
        useLinkPresentationStore().patch(
          graphScopeOf(rootGraph),
          link.id,
          presentation
        )
      }
      const canvas = createCanvas(rootGraph)

      const results = canvas._deserializeItems(
        canvas._serializeItems([origin, target]),
        {}
      )
      if (!results) throw new Error('Paste produced no results')
      const { links } = results

      const pasted = [...links.values()][0]
      expect(pasted).toBeDefined()
      expect(pasted.id).not.toBe(link.id)
      expect(
        useLinkPresentationStore().getPresentation(
          graphScopeOf(rootGraph),
          pasted.id
        )
      ).toEqual(expected)
    }
  )

  it.for([
    { presentation: { hidden: 'false', label: 1 }, expected: undefined },
    { presentation: { hidden: true, label: null }, expected: { hidden: true } },
    { presentation: { hidden: 1, label: '' }, expected: { label: '' } }
  ])(
    'ignores invalid presentation fields in clipboard JSON %#',
    ({ presentation, expected }) => {
      const rootGraph = createTestRootGraph()
      const origin = createTestNode(rootGraph, [], ['number'])
      const target = createTestNode(rootGraph, ['number'])
      const link = origin.connect(0, target, 0)
      if (!link) throw new Error('Failed to connect clipboard test link')
      const canvas = createCanvas(rootGraph)
      const items = canvas._serializeItems([origin, target])
      localStorage.setItem(
        'litegrapheditor_clipboard',
        JSON.stringify({
          ...items,
          links: items.links?.map((item) => ({ ...item, ...presentation }))
        })
      )
      onTestFinished(() => localStorage.removeItem('litegrapheditor_clipboard'))

      const results = canvas._pasteFromClipboard()
      if (!results) throw new Error('Paste produced no results')
      const pasted = [...results.links.values()][0]

      expect(pasted).toBeDefined()
      expect(pasted.id).not.toBe(link.id)
      expect(
        useLinkPresentationStore().getPresentation(
          graphScopeOf(rootGraph),
          pasted.id
        )
      ).toEqual(expected)
    }
  )
})

function registerClipboardNodeType(type: string): void {
  class ClipboardNode extends LGraphNode {
    constructor() {
      super('Clipboard Node')
      this.addInput('input', '*')
      this.addOutput('output', '*')
    }
  }
  LiteGraph.registerNodeType(type, ClipboardNode)
}

describe('_deserializeItems paste-time migration & auto-expose', () => {
  let originalFlush: typeof LGraph.proxyWidgetMigrationFlush
  let originalAutoExpose: typeof LGraph.autoExposePreviewNodes

  beforeEach(() => {
    originalFlush = LGraph.proxyWidgetMigrationFlush
    originalAutoExpose = LGraph.autoExposePreviewNodes
  })

  afterEach(() => {
    LGraph.proxyWidgetMigrationFlush = originalFlush
    LGraph.autoExposePreviewNodes = originalAutoExpose
  })

  it('prunes pasted reroutes that no pasted link passes through', () => {
    const nodeType = 'test/clipboard-reroute-prune'
    registerClipboardNodeType(nodeType)

    const rootGraph = new LGraph()
    const canvas = createCanvas(rootGraph)

    const source = LiteGraph.createNode(nodeType)!
    rootGraph.add(source)
    const target = LiteGraph.createNode(nodeType)!
    rootGraph.add(target)
    const link = source.connect(0, target, 0)!
    rootGraph.createReroute([50, 50], link)

    const result = canvas._deserializeItems(
      canvas._serializeItems([...rootGraph.reroutes.values()]),
      { position: [300, 300] }
    )

    expect(result?.reroutes.size).toBe(0)
    expect(result?.created).toHaveLength(0)
    expect(rootGraph.reroutes.size).toBe(1)
  })

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

    const pastedInputLink = rootGraph.links.get(pastedInputLinkId)
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
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
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
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
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

describe('copyToClipboard', () => {
  it('stamps every copy with a new clipboard id, even for an equal payload', () => {
    const rootGraph = createTestRootGraph()
    const node = createTestNode(rootGraph, [], ['number'])
    const canvas = createCanvas(rootGraph)
    onTestFinished(() => {
      localStorage.removeItem('litegrapheditor_clipboard')
      localStorage.removeItem('litegrapheditor_clipboard_id')
    })

    const first = canvas.copyToClipboard([node])
    const firstId = localStorage.getItem('litegrapheditor_clipboard_id')
    const second = canvas.copyToClipboard([node])

    expect(second).toBe(first)
    expect(localStorage.getItem('litegrapheditor_clipboard')).toBe(second)
    expect(firstId).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('litegrapheditor_clipboard_id')).not.toBe(
      firstId
    )
  })
})

describe('clipboard reroute id integrity', () => {
  const carrierType = 'test/reroute-carrier'

  function createRerouteSubgraph(subgraphId: string): ExportedSubgraph {
    return {
      id: subgraphId,
      version: 1,
      revision: 0,
      state: {
        lastNodeId: 11,
        lastLinkId: 1,
        lastGroupId: 0,
        lastRerouteId: 2
      },
      config: {},
      name: 'Reroute Subgraph',
      inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 10, 10] },
      outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 10, 10] },
      inputs: [],
      outputs: [],
      widgets: [],
      nodes: [
        createSerialisedNode(10, carrierType),
        createSerialisedNode(11, carrierType)
      ],
      links: [
        {
          id: 1,
          type: '*',
          origin_id: 10,
          origin_slot: 0,
          target_id: 11,
          target_slot: 0,
          parentId: 2
        }
      ],
      reroutes: [
        { id: 1, pos: [10, 10], linkIds: [1] },
        { id: 2, parentId: 1, pos: [20, 20], linkIds: [1] }
      ],
      groups: []
    }
  }

  function createLiveRerouteSubgraph(rootGraph: LGraph) {
    const subgraphId = createUuidv4()
    const exported = createRerouteSubgraph(subgraphId)
    const subgraph = rootGraph.createSubgraph(exported)
    const host = LiteGraph.createNode(subgraphId)
    if (!host) throw new Error('Expected subgraph node type to be registered')
    rootGraph.add(host)
    return { subgraph, host }
  }

  it('copying a subgraph node leaves the live subgraph in control of its reroute registrations', () => {
    registerClipboardNodeType(carrierType)
    const rootGraph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const canvas = createCanvas(rootGraph)
    const { subgraph, host } = createLiveRerouteSubgraph(rootGraph)

    canvas._serializeItems([host])

    const store = useRerouteStore()
    const terminal = subgraph.reroutes.get(toRerouteId(2))!
    terminal.parentId = undefined
    expect(
      store.getReroute(graphScopeOf(subgraph), toRerouteId(2))?.parentId
    ).toBeUndefined()

    subgraph.removeReroute(toRerouteId(1))
    expect(
      store.getReroute(graphScopeOf(subgraph), toRerouteId(1))
    ).toBeUndefined()
  })

  it('pasting a subgraph node remaps colliding reroute ids instead of hijacking live registrations', () => {
    registerClipboardNodeType(carrierType)
    const rootGraph = new LGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const canvas = createCanvas(rootGraph)
    const { subgraph: liveSubgraph } = createLiveRerouteSubgraph(rootGraph)

    const clipboardSubgraphId = createUuidv4()
    const parsed: ClipboardItems = {
      nodes: [createSerialisedNode(99, clipboardSubgraphId)],
      groups: [],
      reroutes: [],
      links: [],
      subgraphs: [createRerouteSubgraph(clipboardSubgraphId)]
    }

    const result = canvas._deserializeItems(parsed, { position: [300, 300] })
    const pasted = [...(result?.subgraphs.values() ?? [])][0]
    expect(pasted).toBeDefined()

    const liveIds = [...liveSubgraph.reroutes.keys()]
    const pastedIds = [...pasted.reroutes.keys()]
    expect(pastedIds).toHaveLength(2)
    expect(new Set([...liveIds, ...pastedIds]).size).toBe(4)

    const [pastedLink] = [...pasted.links.values()]
    expect(pastedIds).toContain(pastedLink.parentId)

    const store = useRerouteStore()
    const terminal = liveSubgraph.reroutes.get(toRerouteId(2))!
    terminal.parentId = undefined
    expect(
      store.getReroute(graphScopeOf(liveSubgraph), toRerouteId(2))?.parentId
    ).toBeUndefined()

    liveSubgraph.removeReroute(toRerouteId(1))
    expect(
      store.getReroute(graphScopeOf(liveSubgraph), toRerouteId(1))
    ).toBeUndefined()
  })
})

// A bulk-add path (paste, insert-workflow) calls `graph.add(node)`
// before `node.configure(info)` sets the real position. `graph.add()`
// synchronously fires `attachNodeLayout`, which snapshots `node._pos` into a
// `createNode` layout operation right then — while it still holds
// `LGraphNode`'s constructor default of `[10, 10]`, not the position the
// paste is about to configure. Anything that mints wire ops off that layout
// change feed (the agent CRDT layout-mint port) permanently records the
// wrong position, even though the node visibly lands in the right place on
// canvas once `configure()` runs.
describe('paste-time createNode layout snapshot ordering', () => {
  it('the createNode layout snapshot carries the pasted position, not the pre-configure default', () => {
    const nodeType = 'test/pm1295-position-fingerprint'
    registerClipboardNodeType(nodeType)

    const rootGraph = new LGraph()
    const canvas = createCanvas(rootGraph)
    const source = LiteGraph.createNode(nodeType)!
    source.pos = [500, 500]
    rootGraph.add(source)

    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')

    const result = canvas._deserializeItems(canvas._serializeItems([source]), {
      position: [900, 900]
    })
    const pastedNode = [...(result?.nodes.values() ?? [])][0]
    expect(pastedNode).toBeDefined()

    const createNodeOp = applyOperation.mock.calls
      .map(([op]) => op)
      .find((op) => op.type === 'createNode' && op.nodeId === pastedNode.id)
    if (createNodeOp?.type !== 'createNode')
      throw new Error('expected a createNode layout operation')

    expect(createNodeOp.layout.position).toEqual({
      x: pastedNode.pos[0],
      y: pastedNode.pos[1]
    })
  })
})
