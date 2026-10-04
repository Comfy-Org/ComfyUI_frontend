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
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { attachDocOpMinter } from './docOpMinter'
import { encodeBase64 } from './docFrameClient'
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

  function mountBoundFollower(graph: LGraph, withMinter: boolean) {
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
    const minter = withMinter
      ? attachDocOpMinter({
          isEnabled: () => true,
          isDocBound: () => isTargetActive.value,
          enqueue: followerApi.enqueueHumanOperations,
          getGraph: () => graph,
          boundRootGraphId: () => null,
          docInputNames: followerApi.docInputNames
        })
      : null
    const cleanup = () => {
      minter?.detach()
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

  it.for([
    { name: 'a catalogued node', type: 'TestSource' },
    { name: 'a frontend-only (virtual) node', type: 'TestVirtual' }
  ])(
    'keeps $name whose add is in flight when the tab deactivates and a snapshot without it arrives on return',
    async ({ type }) => {
      const graph = new LGraph()
      graph.add(createRegisteredNode('TestSource'))
      const { host, isTargetActive, cleanup } = mountBoundFollower(graph, true)
      try {
        deliverCatchUp(host, 1)

        const added = createRegisteredNode(type)
        graph.add(added)
        await Promise.resolve()
        await Promise.resolve()

        const addFrames = frames(sent, 'doc_ops')
        expect(addFrames).toHaveLength(1)
        const ops = addFrames[0].data.ops ?? []
        expect(ops.map((op) => op.op)).toEqual(['add_node'])

        isTargetActive.value = false
        await nextTick()
        expect(frames(sent, 'doc_unsubscribe')).toHaveLength(1)

        isTargetActive.value = true
        await nextTick()
        expect(frames(sent, 'doc_subscribe')).toHaveLength(2)
        deliverCatchUp(host, 1)
        await nextTick()

        expect(graph.getNodeById(added.id)).toBe(added)

        const { outcomes } = applyOps(host, ops, CATALOG)
        expect(outcomes.map((outcome) => outcome.outcome)).toEqual(['applied'])
        deliver('doc_ops_result', {
          v: 1,
          workflow_id: WORKFLOW_ID,
          ok: true,
          applied: ops.map((op) => op.op_id),
          skipped: []
        })
        deliver('doc_update', {
          v: 1,
          workflow_id: WORKFLOW_ID,
          seq: 2,
          actor: ops[0].actor,
          op_ids: ops.map((op) => op.op_id),
          update_b64: encodeBase64(Y.encodeStateAsUpdate(host))
        })
        await nextTick()

        expect(graph.getNodeById(added.id)).toBe(added)
        await vi.advanceTimersByTimeAsync(30_000)
        expect(frames(sent, 'doc_ops')).toHaveLength(1)
      } finally {
        cleanup()
      }
    }
  )

  it('keeps a node that was never minted when the tab returns to a snapshot without it', async () => {
    const graph = new LGraph()
    graph.add(createRegisteredNode('TestSource'))
    const { host, isTargetActive, cleanup } = mountBoundFollower(graph, false)
    try {
      deliverCatchUp(host, 1)
      const added = createRegisteredNode('TestVirtual')
      graph.add(added)

      isTargetActive.value = false
      await nextTick()
      isTargetActive.value = true
      await nextTick()
      deliverCatchUp(host, 1)
      await nextTick()

      expect(frames(sent, 'doc_ops')).toHaveLength(0)
      expect(graph.getNodeById(added.id)).toBe(added)
    } finally {
      cleanup()
    }
  })
})
