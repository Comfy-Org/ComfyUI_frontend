import {
  applyOps,
  linksMap,
  mint,
  nodesMap
} from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { DocChangeCollector } from './docChangeCollector'
import { LiveGraphApplier } from './liveGraphApplier'
import type { LiveGraphApplierDeps } from './liveGraphApplier'
import { NO_PENDING_LOCAL_EDITS, widgetKey } from './pendingLocalEdits'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

class TestSource extends LGraphNode {
  constructor() {
    super('Test Source')
    this.addWidget('number', 'steps', 20, () => {})
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestSink extends LGraphNode {
  constructor() {
    super('Test Sink')
    this.addInput('image', 'IMAGE')
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: ['steps'] },
    TestSink: { widget_order: [] }
  }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

function sourceNode(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'TestSource',
    pos: [0, 0],
    size: [200, 100],
    outputs: [{ name: 'image', type: 'IMAGE', links: [] }],
    widgets_values: [20],
    ...extra
  }
}

function sinkNode(id: number, pos: [number, number] = [400, 0]) {
  return {
    id,
    type: 'TestSink',
    pos,
    size: [200, 100],
    inputs: [{ name: 'image', type: 'IMAGE', link: null }]
  }
}

function setup(
  workflow: WorkflowJSON,
  deps: Omit<LiveGraphApplierDeps, 'getGraph'> = {}
) {
  const graph = new LGraph()
  const doc = mint(workflow, CATALOG)
  const collector = new DocChangeCollector(doc)
  const applier = new LiveGraphApplier({ ...deps, getGraph: () => graph })
  onTestFinished(() => {
    collector.destroy()
    doc.destroy()
  })
  const applyEdit = (edit: () => void) => {
    doc.transact(edit)
    return applier.applyChanges(doc, collector.take(), CONTEXT)
  }
  return { graph, doc, collector, applier, applyEdit }
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestSink', TestSink)
})

describe('LiveGraphApplier', () => {
  it('creates document nodes and links with the document ids, without the placement ghost flag', () => {
    const { graph, doc, applier } = setup({
      nodes: [
        sourceNode(1, { flags: { ghost: true, collapsed: true } }),
        sinkNode(2)
      ],
      links: [[7, 1, 0, 2, 0, 'IMAGE']]
    })

    const result = applier.syncFromDoc(doc, CONTEXT)

    expect(result.createdNodeIds).toEqual([toNodeId(1), toNodeId(2)])
    const source = graph.getNodeById(toNodeId(1))
    expect(source?.flags).toEqual({ collapsed: true })
    expect(source?.widgets?.[0]?.value).toBe(20)
    const link = graph.links.get(toLinkId(7))
    expect(link).toMatchObject({
      origin_id: toNodeId(1),
      target_id: toNodeId(2)
    })
    expect(graph.state.lastLinkId).toBeGreaterThanOrEqual(7)
  })

  it('replaces live flags with the document flags but keeps a live placement ghost', () => {
    const { graph, doc, applier, applyEdit } = setup({
      nodes: [sourceNode(1, { flags: { pinned: true } })],
      links: []
    })
    applier.syncFromDoc(doc, CONTEXT)
    const node = graph.getNodeById(toNodeId(1))
    if (!node) throw new Error('node 1 was not created')
    node.flags.ghost = true

    applyEdit(() => {
      nodesMap(doc).get('1')?.set('flags', { collapsed: true })
    })

    expect(node.flags).toEqual({ collapsed: true, ghost: true })
  })

  it('applies the rest of a frame when one operation throws, and reports it once', () => {
    const { graph, doc, applier, applyEdit } = setup({
      nodes: [sourceNode(1)],
      links: []
    })
    applier.syncFromDoc(doc, CONTEXT)
    const doomed = graph.getNodeById(toNodeId(1))
    if (!doomed) throw new Error('node 1 was not created')
    doomed.onRemoved = () => {
      throw new Error('extension hook exploded')
    }

    const result = applyEdit(() => {
      nodesMap(doc).delete('1')
      nodesMap(doc).set('2', new Y.Map<unknown>(Object.entries(sinkNode(2))))
    })

    expect(result.createdNodeIds).toEqual([toNodeId(2)])
    expect(graph.getNodeById(toNodeId(2))).toBeTruthy()
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'extension hook exploded' }),
      expect.objectContaining({
        errorType: 'agent_graph_apply_failed',
        context: { actor: 'agent:test', opIds: ['op-1'] }
      })
    )
  })

  describe('full sync reconciles the live graph to the document', () => {
    function reconcileSetup() {
      const { graph, doc, applier } = setup({
        nodes: [sourceNode(1), sourceNode(2), sinkNode(3)],
        links: [[40, 1, 0, 3, 0, 'IMAGE']]
      })
      applier.syncFromDoc(doc, CONTEXT)
      const node = (id: number) => {
        const found = graph.getNodeById(toNodeId(id))
        if (!found) throw new Error(`node ${id} was not created`)
        return found
      }
      const addLocalNode = () => {
        const local = LiteGraph.createNode('TestSource')
        if (!local) throw new Error('TestSource not registered')
        graph.add(local)
        return local
      }
      return { graph, doc, applier, node, addLocalNode }
    }
    const liveNodeIds = (graph: LGraph) => graph._nodes.map((n) => n.id)

    it('removes nodes and links the document lacks and re-creates a locally deleted document node', () => {
      const { graph, doc, applier, node, addLocalNode } = reconcileSetup()
      addLocalNode()
      node(1).disconnectOutput(0)
      node(2).connect(0, node(3), 0)
      graph.remove(node(2))

      const result = applier.syncFromDoc(doc, CONTEXT)

      expect(result.createdNodeIds).toEqual([toNodeId(2)])
      expect(liveNodeIds(graph)).toEqual([
        toNodeId(1),
        toNodeId(3),
        toNodeId(2)
      ])
      expect([...graph.links.keys()]).toEqual([toLinkId(40)])
    })

    it('spares a pending local add and a pending local delete', () => {
      const { graph, doc, applier, node, addLocalNode } = reconcileSetup()
      const local = addLocalNode()
      graph.remove(node(2))

      const result = applier.syncFromDoc(doc, CONTEXT, {
        ...NO_PENDING_LOCAL_EDITS,
        addedNodeIds: new Set([String(local.id)]),
        deletedNodeIds: new Set(['2'])
      })

      expect(result.createdNodeIds).toEqual([])
      expect(liveNodeIds(graph)).toEqual([toNodeId(1), toNodeId(3), local.id])
    })

    it('keeps a pending local widget value and overwrites the rest', () => {
      const { doc, applier, node } = reconcileSetup()
      node(1).widgets![0].value = 30
      node(2).widgets![0].value = 30

      applier.syncFromDoc(doc, CONTEXT, {
        ...NO_PENDING_LOCAL_EDITS,
        widgetKeys: new Set([widgetKey(1, 'steps')])
      })

      expect(node(1).widgets![0].value).toBe(30)
      expect(node(2).widgets![0].value).toBe(20)
    })

    it('spares a pending local disconnect and a pending local connect', () => {
      const { graph, doc, applier, node } = reconcileSetup()
      node(1).disconnectOutput(0)
      const localLink = node(2).connect(0, node(3), 0)
      if (!localLink) throw new Error('local connect failed')

      applier.syncFromDoc(doc, CONTEXT, {
        ...NO_PENDING_LOCAL_EDITS,
        linkIds: new Set([toLinkId(40), localLink.id])
      })

      expect([...graph.links.keys()]).toEqual([localLink.id])
      expect(node(3).inputs[0]?.link).toBe(localLink.id)
    })
  })

  it('mints a later local link above every document link id', () => {
    const { graph, doc, applier } = setup({
      nodes: [sourceNode(1), sinkNode(2), sourceNode(3), sinkNode(4)],
      links: [[40, 1, 0, 2, 0, 'IMAGE']]
    })
    applier.syncFromDoc(doc, CONTEXT)

    const origin = graph.getNodeById(toNodeId(3))
    const target = graph.getNodeById(toNodeId(4))
    if (!origin || !target) throw new Error('nodes 3 and 4 were not created')

    expect(origin.connect(0, target, 0)?.id).toBeGreaterThan(40)
  })

  it('removes a live link whose document entry now names a slot the node lacks', () => {
    const { graph, doc, applier, applyEdit } = setup({
      nodes: [sourceNode(1), sinkNode(2)],
      links: [[7, 1, 0, 2, 0, 'IMAGE']]
    })
    applier.syncFromDoc(doc, CONTEXT)
    expect(graph.links.has(toLinkId(7))).toBe(true)

    applyEdit(() => {
      nodesMap(doc)
        .get('2')
        ?.set('inputs', [{ name: 'bogus', type: 'IMAGE', link: 7 }])
      linksMap(doc).set('7', [7, 1, 0, 2, 0, 'IMAGE'])
    })

    expect(graph.links.has(toLinkId(7))).toBe(false)
    expect(reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorType: 'agent_graph_link_unresolved' })
    )
  })

  it('parks a far offscreen batch beside existing content and leaves updated nodes where they are', () => {
    const viewport = { x: 0, y: 0, width: 1000, height: 1000 }
    const { graph, doc, applier, applyEdit } = setup(
      { nodes: [sourceNode(1)], links: [] },
      { viewportBounds: () => viewport }
    )
    applier.syncFromDoc(doc, CONTEXT)
    const existing = graph.getNodeById(toNodeId(1))
    if (!existing) throw new Error('node 1 was not created')
    const positionOf = (id: number) => [
      ...(graph.getNodeById(toNodeId(id))?.pos ?? [])
    ]

    applyEdit(() => {
      nodesMap(doc).get('1')?.set('title', 'renamed')
      nodesMap(doc).set(
        '2',
        new Y.Map<unknown>(Object.entries(sourceNode(2, { pos: [9000, 9000] })))
      )
      nodesMap(doc).set(
        '3',
        new Y.Map<unknown>(Object.entries(sinkNode(3, [9400, 9000])))
      )
    })

    expect(existing.title).toBe('renamed')
    expect(positionOf(1)).toEqual([0, 0])
    expect(positionOf(2)).toEqual([280, 0])
    expect(positionOf(3)).toEqual([680, 0])
  })

  it('scopes every write to the remote actor', () => {
    const actors: string[] = []
    const { doc, applier } = setup(
      { nodes: [sourceNode(1)], links: [] },
      {
        withRemoteActor: (actor, fn) => {
          actors.push(actor)
          return fn()
        }
      }
    )

    applier.syncFromDoc(doc, { actor: 'agent:remote', opIds: [] })
    applier.clear({ actor: 'agent:reset', opIds: [] })

    expect(actors).toEqual(['agent:remote', 'agent:reset'])
  })
})

type OpBody = DistributiveOmit<Op, keyof OpEnvelope>
type OpEnvelope = Pick<Op, 'op_id' | 'actor' | 'base_version' | 'stamp'>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

function envelope(body: OpBody): Op {
  const stamp: OpEnvelope = {
    op_id: 'bracket-op'.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test']
  }
  return { ...stamp, ...body }
}

/**
 * A canvas that only records the undo bracket: `emitBeforeChange` /
 * `emitAfterChange` are what the change tracker listens for, `setDirty` and
 * `clear` are the only other canvas calls a frame makes.
 */
function recordingCanvas() {
  const events: Array<'before' | 'after'> = []
  const canvas = fromPartial<LGraphCanvas>({
    emitBeforeChange: () => events.push('before'),
    emitAfterChange: () => events.push('after'),
    setDirty: () => {},
    clear: () => {},
    deselect: () => {},
    checkPanels: () => {}
  })
  return { canvas, events }
}

describe('LiveGraphApplier change bracket', () => {
  const seed: WorkflowJSON = {
    nodes: [
      sourceNode(1, {
        outputs: [{ name: 'image', type: 'IMAGE', links: [7] }]
      }),
      {
        ...sinkNode(2),
        inputs: [{ name: 'image', type: 'IMAGE', link: 7 }]
      },
      sourceNode(3)
    ],
    links: [[7, 1, 0, 2, 0, 'IMAGE']]
  }

  it.for<{ name: string; op: Op }>([
    {
      name: 'add_node',
      op: envelope({
        op: 'add_node',
        node_id: 9,
        class_type: 'TestSink',
        pos: [0, 300],
        node: sinkNode(9)
      })
    },
    {
      name: 'delete_node',
      op: envelope({
        op: 'delete_node',
        node_id: 1,
        removed_links: [7]
      })
    },
    {
      name: 'connect',
      op: envelope({
        op: 'connect',
        link_id: 8,
        from_node: 3,
        from_slot: 0,
        to_node: 2,
        to_slot: 0,
        link_type: 'IMAGE'
      })
    },
    {
      name: 'disconnect',
      op: envelope({
        op: 'disconnect',
        link_id: 7,
        to_node: 2,
        to_slot: 0
      })
    },
    {
      name: 'set_widget',
      op: envelope({
        op: 'set_widget',
        node_id: 1,
        widget: 'steps',
        value: 35
      })
    },
    {
      name: 'set_node_field',
      op: envelope({
        op: 'set_node_field',
        node_id: 1,
        field: 'title',
        value: 'Renamed'
      })
    },
    {
      name: 'clear',
      op: envelope({ op: 'clear', removed_nodes: [1, 2, 3] })
    }
  ])(
    'applies a $name frame inside exactly one before/after bracket that changes the graph',
    ({ op }) => {
      const { graph, doc, applier, collector } = setup(seed)
      applier.syncFromDoc(doc, CONTEXT)
      collector.take()
      const { canvas, events } = recordingCanvas()
      graph.list_of_graphcanvas = [canvas]
      const before = graph.serialize()

      expect(applyOps(doc, [op], CATALOG).outcomes).toEqual([
        { op_id: op.op_id, outcome: 'applied' }
      ])
      applier.applyChanges(doc, collector.take(), CONTEXT)

      expect(events).toEqual(['before', 'after'])
      expect(graph.serialize()).not.toEqual(before)
    }
  )

  it('brackets a document reset and a full sync once each, and never without a graph', () => {
    const { graph, doc, applier } = setup(seed)
    const { canvas, events } = recordingCanvas()
    graph.list_of_graphcanvas = [canvas]

    applier.syncFromDoc(doc, CONTEXT)
    applier.clear(CONTEXT)

    expect(events).toEqual(['before', 'after', 'before', 'after'])
    expect(graph._nodes).toEqual([])

    const detached = new LiveGraphApplier({ getGraph: () => null })
    detached.syncFromDoc(doc, CONTEXT)
    detached.clear(CONTEXT)
    expect(events).toHaveLength(4)
  })
})
