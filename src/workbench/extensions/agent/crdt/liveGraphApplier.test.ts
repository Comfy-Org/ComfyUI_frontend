import { applyOps, linksMap, nodesMap } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedNode,
  LGraphCanvas
} from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'
import type { LiveGraphApplierDeps } from './liveGraphApplier'

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

/** Keeps the definition's output names through `configure`, as `ComfyNode` does. */
class TestDefinedSource extends LGraphNode {
  constructor() {
    super('Test Defined Source')
    this.addOutput('image', 'IMAGE')
  }

  override configure(info: ISerialisedNode): void {
    super.configure({
      ...info,
      outputs: info.outputs?.map((output, index) => ({
        ...output,
        name: this.outputs[index]?.name ?? output.name
      }))
    })
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestSource: { widget_order: ['steps'] },
    TestDefinedSource: { widget_order: [] },
    TestSink: { widget_order: [] }
  }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

function sourceNode(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'TestSource',
    pos: [0, 0],
    size: [210, 100],
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
  const { doc, collector } = followedDoc(workflow, CATALOG)
  const applier = new LiveGraphApplier({ ...deps, getGraph: () => graph })
  /** Applies the catch-up frame the follower received, or anything since. */
  const applyCollected = (context = CONTEXT) =>
    applier.applyChanges(doc, collector.take(), context)
  const applyEdit = (edit: () => void) => {
    doc.transact(edit)
    return applyCollected()
  }
  return { graph, doc, collector, applier, applyCollected, applyEdit }
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestDefinedSource', TestDefinedSource)
  LiteGraph.registerNodeType('TestSink', TestSink)
})

describe('LiveGraphApplier', () => {
  it('creates document nodes and links with the document ids, without the placement ghost flag', () => {
    const { graph, applyCollected } = setup({
      nodes: [
        sourceNode(1, { flags: { ghost: true, collapsed: true } }),
        sinkNode(2)
      ],
      links: [[7, 1, 0, 2, 0, 'IMAGE']]
    })

    const result = applyCollected()

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

  it.for([
    { label: 'undersized', size: [10, 10] },
    { label: 'absent', size: undefined }
  ])(
    'floors a created node at its computed size when the document size is $label',
    ({ size }) => {
      const { graph, applyCollected } = setup({
        nodes: [sourceNode(1, { size })],
        links: []
      })
      applyCollected()

      const node = graph.getNodeById(toNodeId(1))
      expect([...(node?.size ?? [])]).toEqual([
        ...new TestSource().computeSize()
      ])
    }
  )

  it('keeps a document size that already fits the node content', () => {
    const { graph, applyCollected } = setup({
      nodes: [sourceNode(1, { size: [600, 400] })],
      links: []
    })
    applyCollected()

    expect([...(graph.getNodeById(toNodeId(1))?.size ?? [])]).toEqual([
      600, 400
    ])
  })

  it('replaces live flags with the document flags but keeps a live placement ghost', () => {
    const { graph, doc, applyCollected, applyEdit } = setup({
      nodes: [sourceNode(1, { flags: { pinned: true } })],
      links: []
    })
    applyCollected()
    const node = graph.getNodeById(toNodeId(1))
    if (!node) throw new Error('node 1 was not created')
    node.flags.ghost = true

    applyEdit(() => {
      nodesMap(doc).get('1')?.set('flags', { collapsed: true })
    })

    expect(node.flags).toEqual({ collapsed: true, ghost: true })
  })

  it('mirrors one flag register written inside the document flags map onto the live node', () => {
    const { graph, doc, collector, applier, applyCollected } = setup({
      nodes: [sourceNode(1, { flags: { pinned: true } })],
      links: []
    })
    applyCollected()
    const node = graph.getNodeById(toNodeId(1))
    if (!node) throw new Error('node 1 was not created')

    const collapse = envelope({
      op: 'set_node_field',
      node_id: 1,
      field: 'flags.collapsed',
      value: true
    })
    expect(applyOps(doc, [collapse], CATALOG).outcomes).toEqual([
      { op_id: collapse.op_id, outcome: 'applied' }
    ])
    applier.applyChanges(doc, collector.take(), CONTEXT)

    expect(node.flags).toEqual({ pinned: true, collapsed: true })
  })

  it('applies the rest of a frame when one operation throws, and reports it once', () => {
    const { graph, doc, applyCollected, applyEdit } = setup({
      nodes: [sourceNode(1)],
      links: []
    })
    applyCollected()
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

  it('restores a widget and its mirrored property when a widget callback throws', () => {
    const { graph, doc, applyCollected, applyEdit } = setup({
      nodes: [sourceNode(1)],
      links: []
    })
    applyCollected()
    const node = graph.getNodeById(toNodeId(1))
    const widget = node?.widgets?.[0]
    if (!node || !widget) throw new Error('node 1 was not created')
    node.properties.steps = 20
    widget.options.property = 'steps'
    node.onWidgetChanged = () => {
      throw new Error('extension hook exploded')
    }

    applyEdit(() => {
      const widgets = nodesMap(doc).get('1')?.get('widgets')
      if (!(widgets instanceof Y.Map)) throw new Error('named storage')
      widgets.set('steps', 35)
    })

    expect(widget.value).toBe(20)
    expect(node.properties.steps).toBe(20)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'extension hook exploded' }),
      expect.objectContaining({ errorType: 'agent_graph_apply_failed' })
    )
  })

  it('mints a later local link above every document link id', () => {
    const { graph, applyCollected } = setup({
      nodes: [sourceNode(1), sinkNode(2), sourceNode(3), sinkNode(4)],
      links: [[40, 1, 0, 2, 0, 'IMAGE']]
    })
    applyCollected()

    const origin = graph.getNodeById(toNodeId(3))
    const target = graph.getNodeById(toNodeId(4))
    if (!origin || !target) throw new Error('nodes 3 and 4 were not created')

    expect(origin.connect(0, target, 0)?.id).toBeGreaterThan(40)
  })

  it('connects a link from an output whose document name predates the definition, by position', () => {
    const { graph, applyCollected } = setup({
      nodes: [
        {
          ...sourceNode(1, { type: 'TestDefinedSource' }),
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
          widgets_values: []
        },
        sinkNode(2)
      ],
      links: [[7, 1, 0, 2, 0, 'IMAGE']]
    })

    applyCollected()

    expect(graph.getNodeById(toNodeId(1))?.outputs[0]?.name).toBe('image')
    expect(graph.links.get(toLinkId(7))).toMatchObject({
      origin_id: toNodeId(1),
      origin_slot: 0,
      target_id: toNodeId(2)
    })
    expect(reportError).not.toHaveBeenCalled()
  })

  it('removes a live link whose document entry now names a slot the node lacks', () => {
    const { graph, doc, applyCollected, applyEdit } = setup({
      nodes: [sourceNode(1), sinkNode(2)],
      links: [[7, 1, 0, 2, 0, 'IMAGE']]
    })
    applyCollected()
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

  it('reports a document node whose slots are not arrays instead of creating it', () => {
    const { graph, doc, applyCollected, applyEdit } = setup({
      nodes: [sourceNode(1)],
      links: []
    })
    applyCollected()

    applyEdit(() => {
      nodesMap(doc).set(
        '2',
        new Y.Map<unknown>(
          Object.entries({
            ...sinkNode(2),
            inputs: { name: 'image', type: 'IMAGE' }
          })
        )
      )
    })

    expect(graph.getNodeById(toNodeId(2))).toBeNull()
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Document node 2 is malformed')
      }),
      expect.objectContaining({ errorType: 'agent_graph_node_malformed' })
    )
  })

  it('parks a far offscreen batch beside existing content and leaves updated nodes where they are', () => {
    const viewport = { x: 0, y: 0, width: 1000, height: 1000 }
    const { graph, doc, applyCollected, applyEdit } = setup(
      { nodes: [sourceNode(1)], links: [] },
      { viewportBounds: () => viewport }
    )
    applyCollected()
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
    expect(positionOf(2)).toEqual([290, 0])
    expect(positionOf(3)).toEqual([690, 0])
  })

  it('scopes every write to the remote actor', () => {
    const actors: string[] = []
    const { doc, collector, applier, applyCollected } = setup(
      { nodes: [sourceNode(1)], links: [] },
      {
        withRemoteActor: (actor, fn) => {
          actors.push(actor)
          return fn()
        }
      }
    )

    applyCollected({ actor: 'agent:remote', opIds: [] })
    applier.applyChanges(
      doc,
      collector.take(),
      { actor: 'agent:reset', opIds: [] },
      'replace'
    )

    expect(actors).toEqual(['agent:remote', 'agent:reset'])
  })

  it('replaces the graph with a new lineage: shared nodes stay the same instance, the rest leaves, nothing is re-parked', () => {
    const viewport = { x: 0, y: 0, width: 1000, height: 1000 }
    const { graph, applier, applyCollected } = setup(
      {
        nodes: [
          sourceNode(1, {
            outputs: [{ name: 'image', type: 'IMAGE', links: [7] }]
          }),
          {
            ...sinkNode(2),
            inputs: [{ name: 'image', type: 'IMAGE', link: 7 }]
          },
          sourceNode(9, { pos: [0, 300] })
        ],
        links: [[7, 1, 0, 2, 0, 'IMAGE']]
      },
      { viewportBounds: () => viewport }
    )
    applyCollected()
    const shared = graph.getNodeById(toNodeId(1))
    const lineage = followedDoc(
      {
        nodes: [
          sourceNode(1, {
            title: 'kept by id',
            outputs: [{ name: 'image', type: 'IMAGE', links: [8] }]
          }),
          {
            ...sinkNode(3, [9000, 9000]),
            inputs: [{ name: 'image', type: 'IMAGE', link: 8 }]
          }
        ],
        links: [[8, 1, 0, 3, 0, 'IMAGE']]
      },
      CATALOG
    )

    const result = applier.applyChanges(
      lineage.doc,
      lineage.collector.take(),
      CONTEXT,
      'replace'
    )

    expect(result.createdNodeIds).toEqual([toNodeId(3)])
    expect(graph._nodes.map((node) => node.id).sort()).toEqual([
      toNodeId(1),
      toNodeId(3)
    ])
    expect(graph.getNodeById(toNodeId(1))).toBe(shared)
    expect(shared?.title).toBe('kept by id')
    expect([...(graph.getNodeById(toNodeId(3))?.pos ?? [])]).toEqual([
      9000, 9000
    ])
    expect([...graph.links.keys()]).toEqual([toLinkId(8)])
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
 * `emitAfterChange` are what the change tracker listens for; the rest are the
 * calls a frame's node and link writes make on the way through.
 */
function recordingCanvas() {
  const events: Array<'before' | 'after'> = []
  const canvas = fromPartial<LGraphCanvas>({
    emitBeforeChange: () => events.push('before'),
    emitAfterChange: () => events.push('after'),
    setDirty: () => {},
    clear: () => {},
    deselect: () => {},
    checkPanels: () => {},
    selected_nodes: {}
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
      const { graph, doc, applier, collector, applyCollected } = setup(seed)
      applyCollected()
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

  it('brackets a catch-up frame and a lineage replacement once each, and never without a graph', () => {
    const { graph, doc, collector, applier } = setup(seed)
    const { canvas, events } = recordingCanvas()
    graph.list_of_graphcanvas = [canvas]
    const catchUp = collector.peek()
    const empty = followedDoc({ nodes: [], links: [] }, CATALOG)

    applier.applyChanges(doc, collector.take(), CONTEXT)
    applier.applyChanges(empty.doc, empty.collector.take(), CONTEXT, 'replace')

    expect(events).toEqual(['before', 'after', 'before', 'after'])
    expect(graph._nodes).toEqual([])
    expect(reportError).not.toHaveBeenCalled()

    const detached = new LiveGraphApplier({ getGraph: () => null })
    detached.applyChanges(doc, catchUp, CONTEXT)
    detached.applyChanges(empty.doc, empty.collector.take(), CONTEXT, 'replace')
    expect(events).toHaveLength(4)
  })
})
