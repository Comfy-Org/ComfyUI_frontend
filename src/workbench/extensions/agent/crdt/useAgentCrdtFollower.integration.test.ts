import { mint } from '@comfyorg/comfy-multi-player'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import * as Y from 'yjs'

import { render } from '@testing-library/vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { encodeBase64 } from './docFrameClient'
import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const sent: string[] = []

const WORKFLOW_ID = 'wf-late-graph'

class SinkNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Sink', 'Sink')
  }
}

// The agent's one socket, faked at its seam with the real document transport.
let agentSocket = createFakeAgentSocket()

function deliver(type: string, data: unknown): void {
  agentSocket.receive(type, data)
}

describe('useAgentCrdtFollower over a live graph', () => {
  beforeEach(() => {
    sent.length = 0
    vi.stubGlobal('WebSocket', { OPEN: 1 })
    useAgentPanelStore().enabled = true
    LiteGraph.registerNodeType('Sink', SinkNode)
    agentSocket = createFakeAgentSocket()
    agentSocket.send.mockImplementation((frame) => {
      sent.push(frame)
      return true
    })
  })

  it('applies a frame delivered before the graph existed once the graph appears', async () => {
    const graph = shallowRef<LGraph | null>(null)
    const host = mint(
      { nodes: [{ id: 99, type: 'Sink' }], links: [] },
      { types: {} }
    )
    const view = render(
      defineComponent({
        setup() {
          useAgentCrdtFollower(
            ref(WORKFLOW_ID),
            () => null,
            ref(true),
            () => graph.value,
            undefined,
            undefined,
            agentSocket.transport
          )
          return () => null
        }
      }),
      { global: { plugins: [getActivePinia()!] } }
    )

    try {
      deliver('doc_subscribed', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: true,
        seq: 1
      })
      deliver('doc_update', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        update_b64: encodeBase64(Y.encodeStateAsUpdate(host))
      })

      graph.value = new LGraph()
      await nextTick()

      expect(graph.value.getNodeById(toNodeId(99))?.type).toBe('Sink')
    } finally {
      view.unmount()
      host.destroy()
    }
  })
})
