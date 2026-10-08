import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { api } from '@/scripts/api'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { encodeBase64 } from './docFrameClient'
import { attachDocOpMinter } from './docOpMinter'
import { mintWireOps } from './opEnvelope'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const WORKFLOW_ID = 'wf-human-add'
const CATALOG: WidgetCatalog = {
  types: { TestSource: { widget_order: ['steps'] } }
}

class TestSource extends LGraphNode {
  static override title = 'Test Source'
  constructor() {
    super('Test Source')
    this.addWidget('number', 'steps', 20, () => {}, { min: 1, max: 100 })
    this.addOutput('image', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestVirtual extends LGraphNode {
  static override title = 'Test Virtual'
  override isVirtualNode = true
  constructor() {
    super('Test Virtual')
    this.addWidget('text', 'name', 'x', () => {})
    this.serialize_widgets = true
  }
}

function toWorkflowJson({ nodes, ...rest }: ISerialisedGraph): WorkflowJSON {
  return {
    ...rest,
    nodes: nodes.map(({ flags, ...node }) => ({ ...node, flags: { ...flags } }))
  }
}

function deliver(type: string, data: unknown): void {
  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent(type, { detail: data })
  )
}

function frames(sent: string[], type: string) {
  return sent
    .map((raw) => JSON.parse(raw) as { type: string; data: { ops?: Op[] } })
    .filter((frame) => frame.type === type)
}

function nodeIds(graph: LGraph) {
  const scope = graphScopeOf(graph)
  return {
    live: graph._nodes.map((node) => String(node.id)),
    records: useNodeDataStore()
      .getGraphNodesFor(scope.rootGraphId, scope.owningGraphId)
      .map((state) => String(state.id)),
    serialized: graph.serialize().nodes.map((node) => String(node.id))
  }
}

function createRegisteredNode(type: string): LGraphNode {
  const node = LiteGraph.createNode(type)
  if (!node) throw new Error(`${type} not registered`)
  return node
}

describe('a human-added node across a tab switch', () => {
  const sent: string[] = []

  beforeEach(() => {
    sent.length = 0
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', { OPEN: 1 })
    useAgentPanelStore().enabled = true
    LiteGraph.registerNodeType('TestSource', TestSource)
    LiteGraph.registerNodeType('TestVirtual', TestVirtual)
    api.socket = fromPartial<WebSocket>({
      readyState: 1,
      send: vi.fn((frame) => {
        if (typeof frame === 'string') sent.push(frame)
      })
    })
  })

  afterEach(() => {
    api.socket = null
  })

  function mountBoundFollower(graph: LGraph) {
    const host = mint(toWorkflowJson(graph.serialize()), CATALOG)
    const isTargetActive = ref(true)
    let followerApi!: ReturnType<typeof useAgentCrdtFollower>
    const view = render(
      defineComponent({
        setup() {
          followerApi = useAgentCrdtFollower(
            ref(WORKFLOW_ID),
            () => null,
            isTargetActive,
            () => graph
          )
          return () => null
        }
      }),
      { global: { plugins: [getActivePinia()!] } }
    )
    const minter = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => isTargetActive.value,
      enqueue: followerApi.enqueueHumanOperations,
      getGraph: () => graph,
      boundRootGraphId: () => null,
      docInputNames: followerApi.docInputNames,
      docPromotedWidgets: followerApi.docPromotedWidgets,
      isDocPopulated: followerApi.isDocPopulated,
      docIdentity: followerApi.docIdentity
    })
    const cleanup = () => {
      minter.detach()
      view.unmount()
      host.destroy()
    }
    return { host, isTargetActive, cleanup }
  }

  function deliverCatchUp(host: Y.Doc, seq: number): void {
    deliver('doc_subscribed', { v: 1, workflow_id: WORKFLOW_ID, ok: true, seq })
    deliver('doc_update', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      seq,
      actor: 'agent:comfy:host',
      update_b64: encodeBase64(Y.encodeStateAsUpdate(host))
    })
  }

  function acknowledge(ops: Op[]): void {
    deliver('doc_ops_result', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      applied: ops.map((op) => op.op_id),
      skipped: []
    })
  }

  function echo(host: Y.Doc, seq: number, ops: Op[]): void {
    deliver('doc_update', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      seq,
      actor: ops[0].actor,
      op_ids: ops.map((op) => op.op_id),
      update_b64: encodeBase64(Y.encodeStateAsUpdate(host))
    })
  }

  it.for([
    {
      name: 'a catalogued node',
      type: 'TestSource',
      widgetsValues: { steps: 20 }
    },
    {
      name: 'a frontend-only (virtual) node',
      type: 'TestVirtual',
      widgetsValues: ['x']
    }
  ])(
    'keeps $name and delivers a batch queued behind its in-flight add across a tab switch with an advancing host',
    async ({ type, widgetsValues }) => {
      const graph = new LGraph()
      const source = createRegisteredNode('TestSource')
      graph.add(source)
      const { host, isTargetActive, cleanup } = mountBoundFollower(graph)
      try {
        deliverCatchUp(host, 1)

        const added = createRegisteredNode(type)
        graph.add(added)
        await Promise.resolve()
        await Promise.resolve()

        expect(frames(sent, 'doc_ops')).toHaveLength(1)
        const addOps = frames(sent, 'doc_ops')[0].data.ops ?? []
        expect(addOps.map((op) => op.op)).toEqual(['add_node'])
        expect(addOps[0]).toMatchObject({
          node: { widgets_values: widgetsValues }
        })

        source.title = 'Renamed'
        await Promise.resolve()
        await Promise.resolve()
        expect(frames(sent, 'doc_ops')).toHaveLength(1)

        isTargetActive.value = false
        await nextTick()
        expect(frames(sent, 'doc_unsubscribe')).toHaveLength(1)
        await vi.advanceTimersByTimeAsync(5_000)
        expect(frames(sent, 'doc_ops')).toHaveLength(1)

        const agentOps = mintWireOps(
          [
            {
              op: 'set_widget',
              node_id: source.id,
              widget: 'steps',
              value: 55
            }
          ],
          { actor: 'agent:comfy:host', baseVersion: 1 }
        )
        expect(
          applyOps(host, agentOps, CATALOG).outcomes.map(
            (outcome) => outcome.outcome
          )
        ).toEqual(['applied'])

        isTargetActive.value = true
        await nextTick()
        expect(frames(sent, 'doc_subscribe')).toHaveLength(2)
        expect(source.widgets![0].value).toBe(20)
        deliverCatchUp(host, 2)
        await nextTick()

        expect(source.widgets![0].value).toBe(55)
        const retained = [String(source.id), String(added.id)]
        expect(nodeIds(graph)).toEqual({
          live: retained,
          records: retained,
          serialized: retained
        })
        expect(frames(sent, 'doc_ops')).toHaveLength(1)

        expect(
          applyOps(host, addOps, CATALOG).outcomes.map(
            (outcome) => outcome.outcome
          )
        ).toEqual(['applied'])
        acknowledge(addOps)
        echo(host, 3, addOps)
        await nextTick()

        const renameFrames = frames(sent, 'doc_ops')
        expect(renameFrames).toHaveLength(2)
        const renameOps = renameFrames[1].data.ops ?? []
        expect(renameOps).toMatchObject([
          { op: 'set_node_field', node_id: source.id, field: 'title' }
        ])
        expect(
          applyOps(host, renameOps, CATALOG).outcomes.map(
            (outcome) => outcome.outcome
          )
        ).toEqual(['applied'])
        acknowledge(renameOps)
        echo(host, 4, renameOps)
        await nextTick()

        expect(nodeIds(graph)).toEqual({
          live: retained,
          records: retained,
          serialized: retained
        })
        expect(source.widgets![0].value).toBe(55)
        await vi.advanceTimersByTimeAsync(30_000)
        expect(frames(sent, 'doc_ops')).toHaveLength(2)
      } finally {
        cleanup()
      }
    }
  )
})
