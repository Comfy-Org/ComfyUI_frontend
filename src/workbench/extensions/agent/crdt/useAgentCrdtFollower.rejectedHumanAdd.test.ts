import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { parseWireOps } from '@e2e/fixtures/agentWireFrame'

import type { GraphMutations } from './graphMutations'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

// The frame the sender actually put on the wire, narrowed the same way a
// real host would (`parseWireOps`) instead of casting `JSON.parse`'s
// `unknown` straight to a shape this test just asserts is there.
function sentOp(raw: string): { type: unknown; op_id: string } {
  const frame: unknown = JSON.parse(raw)
  const { type, data } =
    typeof frame === 'object' && frame !== null
      ? (frame as { type?: unknown; data?: unknown })
      : {}
  const parsed =
    typeof data === 'object' && data !== null
      ? parseWireOps((data as { ops?: unknown }).ops)
      : { ok: false as const, reason: 'invalid_frame' as const }
  if (!parsed.ok || parsed.ops.length === 0)
    throw new Error('the sent frame carried no wire-shaped op')
  const [op] = parsed.ops
  return { type, op_id: op.op_id }
}

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const WORKFLOW_ID = 'wf-1'

// The verdict the doc host returns for a frontend-only node (Note, a Get/Set
// node from a custom-node pack) or a blueprint host with a promoted widget:
// the class is absent from the pinned catalog, so its named widget values
// cannot be projected and the add is rejected.
it.fails('surfaces a human add_node the doc host rejected instead of swallowing the result', async () => {
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
  await Promise.resolve()
  const { type, op_id } = sentOp(send.mock.calls[1][0])
  expect(type).toBe('doc_ops')

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
  expect(reportError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      context: expect.objectContaining({
        workflowId: WORKFLOW_ID,
        opId: op_id,
        code: 'uncatalogued_widget_write'
      })
    })
  )
})
