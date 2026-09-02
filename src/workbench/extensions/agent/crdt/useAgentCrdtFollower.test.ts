import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

import { render } from '@testing-library/vue'

const apiState = vi.hoisted(() => {
  const docFrames = new EventTarget()
  const socketEvents = new EventTarget()
  const send = vi.fn()

  return {
    docFrames,
    socketEvents,
    send,
    api: {
      socket: { readyState: WebSocket.OPEN, send },
      addCustomEventListener: (type: string, listener: EventListener) =>
        docFrames.addEventListener(type, listener),
      removeCustomEventListener: (type: string, listener: EventListener) =>
        docFrames.removeEventListener(type, listener),
      addEventListener: (type: string, listener: EventListener) =>
        socketEvents.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListener) =>
        socketEvents.removeEventListener(type, listener)
    }
  }
})

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: { createNode: vi.fn() }
}))
vi.mock('@/scripts/api', () => ({ api: apiState.api }))
vi.mock('@/scripts/app', () => ({ app: { graph: null } }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ userId: 'user-1' })
}))
vi.mock('./devPanelLog', () => ({ recordDevEvent: vi.fn() }))
vi.mock('./followerGate', () => ({ resolveFollowerEnabled: () => true }))
vi.mock('./litegraphMutator', () => ({ LitegraphMutator: class {} }))
vi.mock('./semanticProjector', () => ({
  SemanticProjector: class {
    project = vi.fn()
    reset = vi.fn()
  }
}))

import { useAgentCrdtFollower } from './useAgentCrdtFollower'

const DOC_ID_KEY = 'Comfy.Agent.CrdtDocId'
const WORKFLOW_A_DOC_ID = 'doc-for-workflow-a'

function subscribeFrames(): unknown[] {
  return apiState.send.mock.calls
    .map(([frame]) => JSON.parse(frame as string) as { type: string })
    .filter((frame) => frame.type === 'doc_subscribe')
}

describe('useAgentCrdtFollower workflow identity lifecycle', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('current risk: reconnects workflow B to workflow A cached doc id', async () => {
    sessionStorage.setItem(DOC_ID_KEY, WORKFLOW_A_DOC_ID)
    const activeWorkflowId = ref('workflow-a')
    const agentDocId = ref<string | null>(WORKFLOW_A_DOC_ID)
    const host = defineComponent({
      setup() {
        useAgentCrdtFollower(agentDocId)
        return () => activeWorkflowId.value
      }
    })
    const { unmount } = render(host)

    expect(sessionStorage.getItem(DOC_ID_KEY)).toBe(WORKFLOW_A_DOC_ID)

    activeWorkflowId.value = 'workflow-b'
    await nextTick()
    apiState.socketEvents.dispatchEvent(new Event('reconnected'))

    expect(activeWorkflowId.value).toBe('workflow-b')
    expect(sessionStorage.getItem(DOC_ID_KEY)).toBe(WORKFLOW_A_DOC_ID)
    expect(subscribeFrames()).toEqual([
      {
        type: 'doc_subscribe',
        data: {
          v: 1,
          workflow_id: WORKFLOW_A_DOC_ID,
          state_vector_b64: 'AA=='
        }
      },
      {
        type: 'doc_subscribe',
        data: {
          v: 1,
          workflow_id: WORKFLOW_A_DOC_ID,
          state_vector_b64: 'AA=='
        }
      }
    ])
    unmount()
  })
})
