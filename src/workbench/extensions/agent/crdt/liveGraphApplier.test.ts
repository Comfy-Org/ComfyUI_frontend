import { linksMap, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { DocChangeCollector } from './docChangeCollector'
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

function sinkNode(id: number) {
  return {
    id,
    type: 'TestSink',
    pos: [400, 0],
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

  it('never deletes on a full sync and leaves nodes with a pending local delete alone', () => {
    const { graph, doc, applier } = setup({
      nodes: [sourceNode(1), sourceNode(2)],
      links: []
    })
    applier.syncFromDoc(doc, CONTEXT)
    const local = LiteGraph.createNode('TestSource')
    if (!local) throw new Error('TestSource not registered')
    graph.add(local)
    const deletedLocally = graph.getNodeById(toNodeId(2))
    if (!deletedLocally) throw new Error('node 2 was not created')
    graph.remove(deletedLocally)

    const result = applier.syncFromDoc(doc, CONTEXT, new Set(['2']))

    expect(result.createdNodeIds).toEqual([])
    expect(graph._nodes.map((node) => node.id)).toEqual([toNodeId(1), local.id])
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
