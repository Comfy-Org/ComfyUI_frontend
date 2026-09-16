import { fromPartial } from '@total-typescript/shoehorn'
import { render } from '@testing-library/vue'
import { expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import type { GraphMutations } from '@/core/graph/graphMutations'
import { api } from '@/scripts/api'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentCrdtFollower } from './useAgentCrdtFollower'

it('gates real document transport and removes reconnect listeners on revocation', async () => {
  const previousSocket = api.socket
  const send = vi.fn<(frame: string) => void>()
  api.socket = fromPartial<WebSocket>({ readyState: WebSocket.OPEN, send })
  onTestFinished(() => {
    api.socket = previousSocket
  })

  const store = useAgentPanelStore()
  store.enabled = false
  const workflowId = ref<string | null>('wf-1')
  let follower!: ReturnType<typeof useAgentCrdtFollower>
  const { unmount } = render(
    defineComponent({
      setup() {
        follower = useAgentCrdtFollower(
          workflowId,
          fromPartial<GraphMutations>({})
        )
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
  api.dispatchCustomEvent('reconnected')
  api.dispatchCustomEvent('status', null)
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
