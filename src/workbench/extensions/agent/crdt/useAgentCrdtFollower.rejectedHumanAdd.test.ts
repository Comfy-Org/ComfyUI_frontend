import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import type { GraphMutations } from './graphMutations'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const WORKFLOW_ID = 'wf-1'

// The verdict the doc host returns for a frontend-only node (Note, a Get/Set
// node from a custom-node pack) or a blueprint host with a promoted widget:
// the class is absent from the pinned catalog, so its named widget values
// cannot be projected and the add is rejected.
it.fails('surfaces a human add_node the doc host rejected instead of swallowing the result', () => {
  const previousSocket = api.socket
  const send = vi.fn<(frame: string) => void>()
  api.socket = fromPartial<WebSocket>({ readyState: WebSocket.OPEN, send })
  onTestFinished(() => {
    api.socket = previousSocket
  })
  const store = useAgentPanelStore()
  store.enabled = true
  onTestFinished(() => {
    store.enabled = false
  })
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(
          ref<string | null>(WORKFLOW_ID),
          fromPartial<GraphMutations>({})
        )
        return () => null
      }
    })
  )
  onTestFinished(unmount)
  expect(JSON.parse(send.mock.calls[0][0])).toMatchObject({
    type: 'doc_subscribe'
  })

  follower.enqueueHumanOperations([
    {
      op: 'add_node',
      node_id: 7,
      class_type: 'Note',
      pos: [400, 400],
      node: {
        id: 7,
        type: 'Note',
        pos: [400, 400],
        size: [300, 200],
        inputs: [],
        outputs: [],
        widgets_values: { text: 'keep me' }
      }
    }
  ])
  const sent = JSON.parse(send.mock.calls[1][0]) as {
    type: string
    data: { ops: { op_id: string }[] }
  }
  expect(sent.type).toBe('doc_ops')
  const [{ op_id }] = sent.data.ops

  // The transport listens on `api`; a frame from the socket is a CustomEvent there.
  EventTarget.prototype.dispatchEvent.call(
    api,
    new CustomEvent('doc_ops_result', {
      detail: {
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: false,
        applied: [],
        skipped: [],
        failed: {
          index: 0,
          op_id,
          code: 'uncatalogued_widget_write',
          message:
            'add_node(Note): named widgets_values for a class absent from the pinned catalog cannot be projected'
        }
      }
    })
  )

  expect(reportError).toHaveBeenCalled()
})
