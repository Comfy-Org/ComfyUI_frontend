import { applyOps, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { assert } from '@/base/assert'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import {
  graphScopeOf,
  toOwningGraphId,
  toRootGraphId
} from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import type { GraphOperation } from './graphOperations'
import { createGraphMutations } from './graphMutations'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

class TestSource extends LGraphNode {
  static override title = 'Test Source'
  constructor() {
    super('Test Source')
    this.addWidget('number', 'steps', 20, () => {}, { min: 1, max: 100 })
    this.addWidget('number', 'seed', 7, () => {}, { min: 0 })
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestNote extends LGraphNode {
  static override title = 'Note'
  constructor() {
    super('Note')
    this.addInput('image', 'IMAGE')
    this.addWidget('markdown', 'text', '', () => {}, { multiline: true })
    this.serialize_widgets = true
  }
}

function widgetsOf(node: LGraphNode) {
  assert(node.widgets, 'test node registers widgets', { title: node.title })
  return node.widgets
}

const WORKFLOW_ID = 'wf-a'
const CATALOG: WidgetCatalog = {
  types: { TestSource: { widget_order: ['steps', 'seed'] } }
}

const layout = { createNode: vi.fn(), deleteNodes: vi.fn() }

function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout,
    placement: inertPlacementPort
  })
}

function toWorkflowJson({ nodes, ...rest }: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}

function createRegisteredNode<T extends LGraphNode>(
  type: string,
  NodeClass: new () => T
): T {
  const node = LiteGraph.createNode(type)
  if (!(node instanceof NodeClass)) throw new Error(`${type} not registered`)
  return node
}

/** The live graph a user built and saved before the agent ever bound to it. */
function buildLiveGraph() {
  const graph = new LGraph()
  const source = createRegisteredNode('TestSource', TestSource)
  const note = createRegisteredNode('TestNote', TestNote)
  graph.add(source)
  graph.add(note)
  source.pos = [10, 20]
  note.pos = [400, 20]
  note.title = 'Release notes'
  widgetsOf(source)[0].value = 21
  widgetsOf(note)[0].value = '# Draft'
  source.connect(0, note, 0)
  return { graph, source, note }
}

function snapshot(graph: LGraph) {
  const scope = graphScopeOf(graph)
  const widgetStore = useWidgetValueStore()
  return {
    live: graph._nodes.map((node) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      widgets: node.widgets?.map(({ name, type, value }) => [name, type, value])
    })),
    records: useNodeDataStore()
      .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
      .map(({ id, type, title }) => ({ id, type, title })),
    storeWidgets: graph._nodes.map((node) =>
      widgetStore
        .getNodeWidgets(scope.rootGraphId, node.id)
        .map(({ name, type, options, value }) => [name, type, options, value])
    ),
    links: [...graph.links.values()].map((link) => [
      link.id,
      link.origin_id,
      link.origin_slot,
      link.target_id,
      link.target_slot
    ]),
    serialized: graph
      .serialize()
      .nodes.map(({ id, title, widgets_values }) => ({
        id,
        title,
        widgets_values
      }))
  }
}

/**
 * Binds a fresh follower session to the doc minted from the graph's own
 * save and delivers the whole doc as the catch-up frame, the way a return
 * to a previously bound workflow tab does.
 */
function bindAndCatchUp(graph: LGraph, saved: ISerialisedGraph) {
  const host = mint(toWorkflowJson(saved), CATALOG)
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(
    remoteMutations(graphScopeOf(graph)),
    () => graph,
    () => follower.doc
  )
  projection.bind(WORKFLOW_ID, follower)
  let seq = 0
  const deliver = (update: Uint8Array) => {
    follower.applyRemoteUpdate(update)
    expect(
      projection.applyFrame({
        workflowId: WORKFLOW_ID,
        seq: ++seq,
        update,
        actor: 'agent:comfy:host',
        opIds: []
      })
    ).toBe(true)
    projection.reconcileLiveGraph(WORKFLOW_ID)
  }
  deliver(Y.encodeStateAsUpdate(host))
  const hostEdit = (edit: () => void) => {
    const before = Y.encodeStateVector(host)
    host.transact(edit)
    deliver(Y.encodeStateAsUpdate(host, before))
  }
  const destroy = () => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  }
  return { host, hostEdit, destroy }
}

beforeEach(() => {
  layout.createNode.mockReset()
  layout.deleteNodes.mockReset()
  LiteGraph.registerNodeType('TestSource', TestSource)
  LiteGraph.registerNodeType('TestNote', TestNote)
})

describe('AgentCrdtProjection catch-up over a live graph', () => {
  it('leaves a saved workflow displayed as saved after the catch-up frame re-reconciles it', () => {
    const { graph, source, note } = buildLiveGraph()
    const saved = structuredClone(graph.serialize())

    const { destroy } = bindAndCatchUp(graph, saved)

    expect(graph.getNodeById(toNodeId(1))).toBe(source)
    expect(graph.getNodeById(toNodeId(2))).toBe(note)
    expect(layout.createNode).not.toHaveBeenCalled()
    expect(layout.deleteNodes).not.toHaveBeenCalled()
    expect(snapshot(graph)).toEqual({
      live: [
        {
          id: toNodeId(1),
          type: 'TestSource',
          title: 'Test Source',
          widgets: [
            ['steps', 'number', 21],
            ['seed', 'number', 7]
          ]
        },
        {
          id: toNodeId(2),
          type: 'TestNote',
          title: 'Release notes',
          widgets: [['text', 'markdown', '# Draft']]
        }
      ],
      records: [
        { id: toNodeId(1), type: 'TestSource', title: 'Test Source' },
        { id: toNodeId(2), type: 'TestNote', title: 'Release notes' }
      ],
      storeWidgets: [
        [
          ['steps', 'number', { min: 1, max: 100 }, 21],
          ['seed', 'number', { min: 0 }, 7]
        ],
        [['text', 'markdown', { multiline: true }, '# Draft']]
      ],
      links: [[1, toNodeId(1), 0, toNodeId(2), 0]],
      serialized: [
        { id: 1, title: undefined, widgets_values: [21, 7] },
        { id: 2, title: 'Release notes', widgets_values: ['# Draft'] }
      ]
    })
    destroy()
  })

  it('keeps an omitted positional sibling through a partial widget update and a save/reload', () => {
    const { graph, source } = buildLiveGraph()
    const { host, hostEdit, destroy } = bindAndCatchUp(
      graph,
      structuredClone(graph.serialize())
    )

    hostEdit(() => {
      const node = nodesMap(host).get('1')
      if (!(node instanceof Y.Map)) throw new Error('node 1 is not in the doc')
      node.set('widgets', new Y.Map([['steps', 30]]))
    })

    expect(widgetsOf(source).map(({ value }) => value)).toEqual([30, 7])
    const saved = structuredClone(graph.serialize())
    expect(saved.nodes[0].widgets_values).toEqual([30, 7])

    graph.configure(saved)
    expect(
      graph.getNodeById(toNodeId(1))?.widgets?.map((w) => w.value)
    ).toEqual([30, 7])
    destroy()
  })
})

describe('ADR-CRDT-RECONCILE-0035 (c): AgentCrdtProjection forwards the id-collision predicate', () => {
  const scope: GraphScope = {
    rootGraphId: toRootGraphId('root'),
    owningGraphId: toOwningGraphId('root')
  }
  const catalog: WidgetCatalog = {
    types: { Source: { widget_order: [] }, Sink: { widget_order: [] } }
  }

  function op(id: string, baseVersion: number, payload: GraphOperation): Op {
    return {
      op_id: id,
      actor: 'agent:test',
      base_version: baseVersion,
      stamp: [baseVersion, 'agent:test'],
      ...payload
    }
  }

  it('reports a genuine node id collision when constructed without an explicit pendingAddType', () => {
    // Mutates the follower's own doc directly via the library's applier,
    // rather than a separate host doc diffed and replayed through
    // `applyRemoteUpdate`: this test is only about which `pendingAddType`
    // reaches the adapter, not about wire delivery (already covered by
    // ecsFollowerAdapter.integration.test.ts's harness).
    const follower = new FollowerDoc()
    onTestFinished(() => follower.destroy())
    const mutations = createGraphMutations({
      getScope: () => scope,
      layout: { createNode: vi.fn(), deleteNodes: vi.fn() },
      placement: inertPlacementPort
    })
    // No fourth argument: AgentCrdtProjection's own default (`() => undefined`)
    // must reach the adapter for this collision to be reported at all.
    const projection = new AgentCrdtProjection(
      mutations,
      () => null,
      () => follower.doc
    )
    onTestFinished(() => projection.destroy())
    projection.bind('wf', follower)

    // An unrelated first frame flips the session's initial full-graph
    // reconcile into the incremental per-change path the collision check
    // below depends on.
    applyOps(
      follower.doc,
      [
        op('op-0', 1, {
          op: 'add_node',
          node_id: 99,
          class_type: 'Sink',
          pos: [0, 0],
          node: { id: 99, type: 'Sink', inputs: [], outputs: [] }
        })
      ],
      catalog
    )
    expect(
      projection.applyFrame({
        workflowId: 'wf',
        seq: 1,
        update: new Uint8Array()
      })
    ).toBe(true)

    // A retained local-only node under id 1 that the document never saw.
    mutations.addNode(
      { id: 1, type: 'LocalOnlyType', pos: [0, 0], inputs: [], outputs: [] },
      { source: 'agent-remote', actor: 'local-hydration', opId: 'local-seed' }
    )

    applyOps(
      follower.doc,
      [
        op('op-1', 2, {
          op: 'add_node',
          node_id: 1,
          class_type: 'Source',
          pos: [5, 5],
          node: { id: 1, type: 'Source', pos: [5, 5], inputs: [], outputs: [] }
        })
      ],
      catalog
    )

    expect(
      projection.applyFrame({
        workflowId: 'wf',
        seq: 2,
        update: new Uint8Array()
      })
    ).toBe(true)

    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_node_id_collision',
      context: { nodeId: '1', localType: 'LocalOnlyType', docType: 'Source' }
    })
  })
})
