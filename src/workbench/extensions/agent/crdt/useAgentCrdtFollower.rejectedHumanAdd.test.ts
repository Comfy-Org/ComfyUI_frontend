import { render } from '@testing-library/vue'
import { expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { parseWireOps } from '@e2e/fixtures/agentWireFrame'

import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import {
  SUBSCRIBE_CATCHUP_GRACE_MS,
  useAgentCrdtFollower
} from './useAgentCrdtFollower'

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

const WORKFLOW_ID = 'wf-1'

// The verdict the doc host returns for a frontend-only node (Note, a Get/Set
// node from a custom-node pack) or a blueprint host with a promoted widget:
// the class is absent from the pinned catalog, so its named widget values
// cannot be projected and the add is rejected.
it('surfaces a human add_node the doc host rejected instead of swallowing the result', async () => {
  const agentSocket = createFakeAgentSocket()
  const { send } = agentSocket
  const store = useAgentPanelStore()
  store.enabled = true
  onTestFinished(() => {
    store.enabled = false
  })
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(ref<string | null>(WORKFLOW_ID), {
          transport: agentSocket.transport
        })
        return () => null
      }
    })
  )
  onTestFinished(unmount)
  agentSocket.receive('doc_subscribed', {
    v: 1,
    workflow_id: WORKFLOW_ID,
    ok: true,
    seq: 0
  })
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
  // opCoalescer defers the flush to a microtask, so the frame is not on the
  // mock until the queue drains.
  await vi.waitFor(() => expect(send.mock.calls.length).toBeGreaterThan(1))
  const { type, op_id } = sentOp(send.mock.calls[1][0])
  expect(type).toBe('doc_ops')

  agentSocket.receive('doc_ops_result', {
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
  })

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

function mountBoundFollower() {
  const agentSocket = createFakeAgentSocket()
  const store = useAgentPanelStore()
  store.enabled = true
  onTestFinished(() => {
    store.enabled = false
  })
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(ref<string | null>(WORKFLOW_ID), {
          transport: agentSocket.transport
        })
        return () => null
      }
    })
  )
  onTestFinished(unmount)
  const confirmSubscribe = () =>
    agentSocket.receive('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 0
    })
  confirmSubscribe()
  const sentFrames = (type: string) =>
    agentSocket.send.mock.calls
      .map(([raw]) => raw)
      .filter((raw) => JSON.parse(raw).type === type)
  return { agentSocket, follower, confirmSubscribe, sentFrames }
}

async function answerCatchUpProbe(confirmSubscribe: () => void) {
  await vi.advanceTimersByTimeAsync(SUBSCRIBE_CATCHUP_GRACE_MS)
  confirmSubscribe()
}

function addNote(nodeId: number) {
  return {
    op: 'add_node' as const,
    node_id: nodeId,
    class_type: 'Note',
    pos: [400, 400] as [number, number],
    node: {
      id: nodeId,
      type: 'Note',
      pos: [400, 400],
      size: [300, 200],
      inputs: [],
      outputs: [],
      widgets_values: { text: 'keep me' }
    }
  }
}

it('surfaces an overwritten human add and resubscribes to the canonical document', async () => {
  const { agentSocket, follower } = mountBoundFollower()
  const { send } = agentSocket

  follower.enqueueHumanOperations([addNote(7)])
  await vi.waitFor(() => expect(send.mock.calls.length).toBeGreaterThan(1))
  const { op_id } = sentOp(send.mock.calls[1][0])

  agentSocket.receive('doc_ops_result', {
    v: 1,
    workflow_id: WORKFLOW_ID,
    ok: true,
    seq: 2,
    applied: [],
    skipped: [op_id],
    lww_dropped: [op_id]
  })

  expect(reportError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      context: expect.objectContaining({
        workflowId: WORKFLOW_ID,
        opId: op_id,
        code: 'lww_dropped'
      })
    })
  )
  expect(send.mock.calls.map(([raw]) => JSON.parse(raw).type)).toEqual([
    'doc_subscribe',
    'doc_ops',
    'doc_subscribe'
  ])
})

it('keeps the next edit queued while the recovery subscribe cannot be sent', async () => {
  const { agentSocket, follower, confirmSubscribe, sentFrames } =
    mountBoundFollower()
  const { send } = agentSocket
  follower.enqueueHumanOperations([addNote(7)])
  await vi.waitFor(() => expect(sentFrames('doc_ops')).toHaveLength(1))
  const { op_id } = sentOp(sentFrames('doc_ops')[0])
  follower.enqueueHumanOperations([addNote(8)])
  await Promise.resolve()

  send.mockImplementation((raw) => JSON.parse(raw).type !== 'doc_subscribe')
  agentSocket.receive('doc_ops_result', {
    v: 1,
    workflow_id: WORKFLOW_ID,
    ok: true,
    seq: 2,
    applied: [],
    skipped: [op_id],
    lww_dropped: [op_id]
  })

  expect(reportError).not.toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      tags: expect.objectContaining({ code: 'unbound' })
    })
  )
  expect(sentFrames('doc_ops')).toHaveLength(1)

  send.mockImplementation(() => true)
  agentSocket.open()
  confirmSubscribe()

  await vi.waitFor(() => expect(sentFrames('doc_ops')).toHaveLength(2))
  expect(sentOp(sentFrames('doc_ops')[1]).op_id).not.toBe(op_id)
})

it('refreshes and reports an edit whose resend is acknowledged only as a replay', async () => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const { agentSocket, follower, confirmSubscribe, sentFrames } =
    mountBoundFollower()
  follower.enqueueHumanOperations([addNote(7)])
  await vi.waitFor(() => expect(sentFrames('doc_ops')).toHaveLength(1))
  const { op_id } = sentOp(sentFrames('doc_ops')[0])
  await answerCatchUpProbe(confirmSubscribe)

  await vi.advanceTimersByTimeAsync(10_000 - SUBSCRIBE_CATCHUP_GRACE_MS)
  expect(sentFrames('doc_ops')).toHaveLength(2)
  const subscribesBeforeResult = sentFrames('doc_subscribe').length
  agentSocket.receive('doc_ops_result', {
    v: 1,
    workflow_id: WORKFLOW_ID,
    ok: true,
    seq: 2,
    applied: [],
    skipped: [op_id]
  })

  expect(reportError).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      context: expect.objectContaining({
        workflowId: WORKFLOW_ID,
        opId: op_id,
        code: 'replayed_without_outcome'
      })
    })
  )
  expect(sentFrames('doc_subscribe')).toHaveLength(subscribesBeforeResult + 1)
})
