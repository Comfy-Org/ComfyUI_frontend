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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { assert } from '@/base/assert'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'
import { inertPlacementPort } from './__fixtures__/inertPlacementPort'

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

describe('AgentCrdtProjection self-driven reconcile retry', () => {
  it('sweeps the stale live node once a retry recovers from a rejected delete-all, without a new frame arriving', () => {
    vi.useFakeTimers()
    try {
      const { graph, source } = buildLiveGraph()
      const scope = graphScopeOf(graph)
      let scopeAvailable = true
      const mutations = createGraphMutations({
        getScope: () => (scopeAvailable ? scope : null),
        layout,
        placement: inertPlacementPort
      })
      const host = mint(
        toWorkflowJson(structuredClone(graph.serialize())),
        CATALOG
      )
      const follower = new FollowerDoc()
      const projection = new AgentCrdtProjection(
        mutations,
        () => graph,
        () => follower.doc
      )
      projection.bind(WORKFLOW_ID, follower)
      let seq = 0
      const deliver = (update: Uint8Array) => {
        follower.applyRemoteUpdate(update)
        const applied = projection.applyFrame({
          workflowId: WORKFLOW_ID,
          seq: ++seq,
          update,
          actor: 'agent:comfy:host',
          opIds: []
        })
        // Mirrors `useAgentCrdtFollower`'s `applyAndReconcile`: the live
        // graph is only ever swept for a frame that actually applied.
        if (applied) projection.reconcileLiveGraph(WORKFLOW_ID)
        return applied
      }

      // Catch-up frame: the doc starts out matching the live graph, so the
      // pre-existing `source` node is adopted as the live adapter for
      // record id 1.
      deliver(Y.encodeStateAsUpdate(host))
      expect(graph.getNodeById(toNodeId(1))).toBe(source)

      // The agent deletes every node from the doc (a delete-all), but scope
      // briefly can't resolve the bound workflow tab, so the batch is
      // rejected: nothing is swept, and the stale node stays live.
      const before = Y.encodeStateVector(host)
      host.transact(() => {
        for (const id of [...nodesMap(host).keys()]) nodesMap(host).delete(id)
        for (const id of [...linksMap(host).keys()]) linksMap(host).delete(id)
      })
      scopeAvailable = false
      const deleteAllUpdate = Y.encodeStateAsUpdate(host, before)
      expect(deliver(deleteAllUpdate)).toBe(false)
      expect(graph.getNodeById(toNodeId(1))).toBe(source)

      // Scope recovers, but no further frame ever arrives (e.g. the user
      // never sends another agent message). The self-driven retry must
      // both commit the store-side reconcile AND sweep the live graph
      // through the same pipeline a normal frame gets, or the stale node
      // would still be there to serialize into the next save.
      scopeAvailable = true
      vi.advanceTimersByTime(5_000)

      expect(useNodeDataStore().getGraphNodesFor('root', 'root')).toEqual([])
      expect(graph.getNodeById(toNodeId(1))).toBeNull()
      expect(layout.deleteNodes).toHaveBeenCalledWith(
        scope,
        [toNodeId(1)],
        expect.anything()
      )

      projection.destroy()
      follower.destroy()
      host.destroy()
    } finally {
      vi.useRealTimers()
    }
  })
})

// PM-1500/PM-1504: Jo Zhang's staging repro. She asked the agent to load the
// "NetaYume Lumina Text to Image" template, then asked it to replace that
// with a different template. The old template's nodes were never deleted;
// the new template's nodes just got inserted alongside them, which looked
// like "insert instead of replace". No recording stack is reachable from a
// unit test, so `buildLiveGraph()`'s two wired nodes stand in for the old
// template, and a hand-built `add_node` op for the new one is folded into
// the same doc update as the clear — one turn's "replace" lands as one CRDT
// frame — driven through the same `AgentCrdtProjection`/`EcsFollowerAdapter`
// chain a real turn uses.
describe('AgentCrdtProjection self-driven reconcile retry — template replace', () => {
  it('replaces the old template with the new one once the dropped frame retries, instead of leaving the old template stuck forever', () => {
    vi.useFakeTimers()
    try {
      const { graph, source, note } = buildLiveGraph()
      const scope = graphScopeOf(graph)
      let scopeAvailable = true
      const mutations = createGraphMutations({
        getScope: () => (scopeAvailable ? scope : null),
        layout,
        placement: inertPlacementPort
      })
      const host = mint(
        toWorkflowJson(structuredClone(graph.serialize())),
        CATALOG
      )
      const follower = new FollowerDoc()
      const projection = new AgentCrdtProjection(
        mutations,
        () => graph,
        () => follower.doc
      )
      projection.bind(WORKFLOW_ID, follower)
      let seq = 0
      const deliver = (update: Uint8Array) => {
        follower.applyRemoteUpdate(update)
        const applied = projection.applyFrame({
          workflowId: WORKFLOW_ID,
          seq: ++seq,
          update,
          actor: 'agent:comfy:host',
          opIds: []
        })
        if (applied) projection.reconcileLiveGraph(WORKFLOW_ID)
        return applied
      }

      // Turn 1: the old template loads and catches up onto the live graph.
      deliver(Y.encodeStateAsUpdate(host))
      expect(graph.getNodeById(toNodeId(1))).toBe(source)
      expect(graph.getNodeById(toNodeId(2))).toBe(note)

      // Turn 2: "replace that with a different template." The agent's
      // replace lands as one frame that both clears the old template and
      // adds the new one's node. Scope briefly can't resolve the bound
      // workflow tab, so the whole batch is rejected: nothing is swept, and
      // both templates' worth of edits are dropped together.
      const before = Y.encodeStateVector(host)
      host.transact(() => {
        for (const id of [...nodesMap(host).keys()]) nodesMap(host).delete(id)
        for (const id of [...linksMap(host).keys()]) linksMap(host).delete(id)
      })
      const insertOp = {
        op_id: 'insert-template-b',
        actor: 'agent:test',
        base_version: 10,
        stamp: [10, 'agent:test'],
        op: 'add_node',
        node_id: 3,
        class_type: 'TestSource',
        pos: [400, 20],
        node: {
          id: 3,
          type: 'TestSource',
          title: 'Flux Sampler',
          pos: [400, 20],
          size: [180, 90],
          inputs: [],
          outputs: [{ name: 'image', type: 'IMAGE', links: [] }]
        }
      } satisfies Op
      applyOps(host, [insertOp], CATALOG)
      scopeAvailable = false
      const replaceFrame = Y.encodeStateAsUpdate(host, before)
      expect(deliver(replaceFrame)).toBe(false)
      expect(graph.getNodeById(toNodeId(1))).toBe(source)
      expect(graph.getNodeById(toNodeId(3))).toBeNull()

      // Scope recovers, but no further frame ever arrives (e.g. the user
      // never sends another agent message). The self-driven retry must
      // replay the dropped replace and sweep the live graph through the
      // same pipeline a normal frame gets, proving the old template
      // actually gets removed and the new one actually gets added — not
      // that the old template is stuck on screen forever (Jo's report) and
      // not that only half of the replace ever lands.
      scopeAvailable = true
      vi.advanceTimersByTime(5_000)

      expect(graph.getNodeById(toNodeId(1))).toBeNull()
      expect(graph.getNodeById(toNodeId(2))).toBeNull()
      expect(graph.getNodeById(toNodeId(3))?.title).toBe('Flux Sampler')
      expect(
        useNodeDataStore()
          .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
          .map(({ id }) => id)
      ).toEqual([toNodeId(3)])
      expect(layout.deleteNodes.mock.calls.flatMap(([, ids]) => ids)).toEqual(
        expect.arrayContaining([toNodeId(1), toNodeId(2)])
      )
      expect(layout.createNode).toHaveBeenCalledWith(
        scope,
        toNodeId(3),
        expect.anything(),
        expect.anything()
      )

      projection.destroy()
      follower.destroy()
      host.destroy()
    } finally {
      vi.useRealTimers()
    }
  })
})
