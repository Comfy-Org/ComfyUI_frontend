import { computed, onBeforeUnmount, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { api } from '@/scripts/api'

import type { DocFrameTransport, DocOp } from './docFrameClient'
import { DocFrameClient } from './docFrameClient'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

const enabled = import.meta.env.VITE_AGENT_CRDT_FOLLOWER === 'true'

export interface AgentCrdtStatus {
  enabled: boolean
  connected: boolean
  workflowId: string | null
  updatesApplied: number
  lastFrameType: string | null
}

const apiTransport: DocFrameTransport = {
  send(frame) {
    if (api.socket?.readyState !== WebSocket.OPEN)
      throw new Error('The ComfyUI WebSocket is not connected')
    api.socket.send(frame)
  },
  addEventListener(type, listener) {
    api.addCustomEventListener(type, listener)
  },
  removeEventListener(type, listener) {
    api.removeCustomEventListener(type, listener)
  }
}

export function useAgentCrdtFollower(workflowId: Ref<string | null>) {
  const connected = ref(false)
  const updatesApplied = ref(0)
  const lastFrameType = ref<string | null>(null)
  const subscribedWorkflowId = ref<string | null>(null)

  if (!enabled) {
    return {
      status: readonly(
        ref<AgentCrdtStatus>({
          enabled: false,
          connected: false,
          workflowId: null,
          updatesApplied: 0,
          lastFrameType: null
        })
      ),
      sendHumanOps: (_ops: DocOp[]) => undefined
    }
  }

  const client = new DocFrameClient(apiTransport)
  const bridge = new LayoutFollowerBridge(client, layoutStore)
  const tabId = crypto.randomUUID()

  const onSubscribed: EventListener = (event) => {
    if (!(event instanceof CustomEvent)) return
    connected.value = event.detail.ok === true
    lastFrameType.value = event.type
  }
  const onUpdate: EventListener = (event) => {
    updatesApplied.value = bridge.follower.updatesApplied
    lastFrameType.value = event.type
  }
  const onOpsResult: EventListener = (event) => {
    lastFrameType.value = event.type
  }
  const onReconnected: EventListener = () => {
    connected.value = false
    bridge.resubscribe()
  }

  bridge.addEventListener('doc_subscribed', onSubscribed)
  bridge.addEventListener('doc_update', onUpdate)
  bridge.addEventListener('doc_ops_result', onOpsResult)
  api.addEventListener('reconnected', onReconnected)

  watch(
    workflowId,
    (next) => {
      connected.value = false
      subscribedWorkflowId.value = next
      if (next === null) bridge.unsubscribe()
      else bridge.subscribe(next)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    api.removeEventListener('reconnected', onReconnected)
    bridge.removeEventListener('doc_subscribed', onSubscribed)
    bridge.removeEventListener('doc_update', onUpdate)
    bridge.removeEventListener('doc_ops_result', onOpsResult)
    bridge.destroy()
    client.destroy()
  })

  const status = computed<AgentCrdtStatus>(() => ({
    enabled: true,
    connected: connected.value,
    workflowId: subscribedWorkflowId.value,
    updatesApplied: updatesApplied.value,
    lastFrameType: lastFrameType.value
  }))

  return {
    status: readonly(status),
    // The semantic canvas-command adapter will call this after it moves to
    // @comfyorg/comfy-multi-player. Raw Yjs client updates are never sent.
    sendHumanOps: (ops: DocOp[]) => bridge.sendHumanOps(tabId, ops)
  }
}
