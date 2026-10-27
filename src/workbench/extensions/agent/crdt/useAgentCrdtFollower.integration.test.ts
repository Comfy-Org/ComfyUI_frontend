import { mint, readSchemaVersion } from '@comfyorg/comfy-multi-player'
import type { DocSubscribedData, DocUpdateData } from '@comfyorg/ingest-types'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import * as Y from 'yjs'

import { render } from '@testing-library/vue'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import {
  DOC_HOST_MINTED_SINK_UPDATE_B64,
  DOC_HOST_MULTI_PLAYER_VERSION,
  DOC_HOST_SCHEMA_VERSION
} from './__fixtures__/docHostMintedSink'
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
          useAgentCrdtFollower(ref(WORKFLOW_ID), {
            transport: agentSocket.transport,
            getGraph: () => graph.value
          })
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
        seq: 1,
        lineage_seq: 1
      } satisfies DocSubscribedData)
      deliver('doc_update', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        lineage_seq: 1,
        update_b64: encodeBase64(Y.encodeStateAsUpdate(host))
      } satisfies DocUpdateData)

      graph.value = new LGraph()
      await nextTick()

      expect(graph.value.getNodeById(toNodeId(99))?.type).toBe('Sink')
    } finally {
      view.unmount()
      host.destroy()
    }
  })

  it(`projects a document minted by the cloud doc-host (comfy-multi-player ${DOC_HOST_MULTI_PLAYER_VERSION})`, async () => {
    const hostDoc = new Y.Doc()
    Y.applyUpdate(
      hostDoc,
      Uint8Array.from(atob(DOC_HOST_MINTED_SINK_UPDATE_B64), (char) =>
        char.charCodeAt(0)
      )
    )
    expect(readSchemaVersion(hostDoc)).toBe(DOC_HOST_SCHEMA_VERSION)
    hostDoc.destroy()

    const graph = shallowRef<LGraph | null>(new LGraph())
    const view = render(
      defineComponent({
        setup() {
          useAgentCrdtFollower(ref(WORKFLOW_ID), {
            transport: agentSocket.transport,
            getGraph: () => graph.value
          })
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
        seq: 1,
        lineage_seq: 1
      } satisfies DocSubscribedData)
      deliver('doc_update', {
        v: 1,
        workflow_id: WORKFLOW_ID,
        seq: 1,
        lineage_seq: 1,
        update_b64: DOC_HOST_MINTED_SINK_UPDATE_B64
      } satisfies DocUpdateData)
      await nextTick()

      expect(graph.value?.getNodeById(toNodeId(99))?.type).toBe('Sink')
    } finally {
      view.unmount()
    }
  })
})
