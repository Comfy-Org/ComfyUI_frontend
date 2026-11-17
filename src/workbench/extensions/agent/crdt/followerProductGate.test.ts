import { render } from '@testing-library/vue'
import { expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { createFakeAgentSocket } from './__fixtures__/agentSocket'
import { hasUnsyncedHumanOps } from './unsyncedHumanOps'
import { useAgentCrdtFollower } from './useAgentCrdtFollower'

it('gates real document transport and removes reconnect listeners on revocation', async () => {
  const agentSocket = createFakeAgentSocket()
  const { send } = agentSocket

  const store = useAgentPanelStore()
  store.enabled = false
  const workflowId = ref<string | null>('wf-1')
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport
        })
        return () => null
      }
    })
  )
  onTestFinished(unmount)

  expect(send).not.toHaveBeenCalled()
  expect(follower.debugSnapshot()).toMatchObject({
    status: { enabled: false, workflowId: null },
    tabId: null,
    nodeIds: [],
    linkIds: []
  })

  store.enabled = true
  expect(send).toHaveBeenCalledOnce()
  expect(JSON.parse(send.mock.calls[0][0])).toMatchObject({
    type: 'doc_subscribe',
    data: { workflow_id: 'wf-1' }
  })

  store.enabled = false
  expect(send).toHaveBeenCalledTimes(2)
  expect(JSON.parse(send.mock.calls[1][0])).toMatchObject({
    type: 'doc_unsubscribe',
    data: { workflow_id: 'wf-1' }
  })
  agentSocket.open()
  workflowId.value = 'wf-2'
  await nextTick()
  vi.advanceTimersByTime(60_000)
  expect(send).toHaveBeenCalledTimes(2)

  store.enabled = true
  expect(send).toHaveBeenCalledTimes(3)
  expect(JSON.parse(send.mock.calls[2][0])).toMatchObject({
    type: 'doc_subscribe',
    data: { workflow_id: 'wf-2' }
  })
  unmount()
  expect(send).toHaveBeenCalledTimes(4)
  expect(JSON.parse(send.mock.calls[3][0])).toMatchObject({
    type: 'doc_unsubscribe',
    data: { workflow_id: 'wf-2' }
  })
})

it('hands an unconfirmed local edit to the follower created after a gate restart', async () => {
  const agentSocket = createFakeAgentSocket()
  const store = useAgentPanelStore()
  store.enabled = true
  const workflowId = ref<string | null>('wf-gate-restart')
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(workflowId, {
          transport: agentSocket.transport
        })
        return () => null
      }
    })
  )
  onTestFinished(unmount)

  follower.noteUnboundLocalIntent()
  expect(hasUnsyncedHumanOps('wf-gate-restart')).toBe(true)

  store.enabled = false
  await nextTick()
  expect(hasUnsyncedHumanOps('wf-gate-restart')).toBe(true)

  store.enabled = true
  await nextTick()
  agentSocket.receive('doc_subscribed', {
    v: 1,
    workflow_id: 'wf-gate-restart',
    ok: true,
    seq: 0,
    lineage_seq: 0
  })
  expect(hasUnsyncedHumanOps('wf-gate-restart')).toBe(false)
})
