import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { render } from '@testing-library/vue'

import type { GraphMutations } from '@/core/graph/graphMutations'

const apiState = vi.hoisted(() => {
  const docFrames = new EventTarget()
  const socketEvents = new EventTarget()
  const send = vi.fn()

  return {
    docFrames,
    socketEvents,
    send,
    api: {
      socket: { readyState: 1, send },
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

vi.mock('@/scripts/api', () => ({ api: apiState.api }))
vi.mock('@/scripts/app', () => ({ app: { graph: null, canvas: null } }))

import { STALE_AFTER_MS, useAgentCrdtFollower } from './useAgentCrdtFollower'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const graphMutations = fromPartial<GraphMutations>({
  clearSemanticGraph: vi.fn(() => true)
})

interface SentFrame {
  type: string
  data: { workflow_id: string }
}

function framesSent(): SentFrame[] {
  return apiState.send.mock.calls.map(
    ([frame]) => JSON.parse(frame) as SentFrame
  )
}

function dispatchServerFrame(
  type: string,
  data: Record<string, unknown>
): void {
  apiState.docFrames.dispatchEvent(
    new CustomEvent(type, { detail: { v: 1, ...data } })
  )
}

function mountFollower(initialWorkflowId: string | null): {
  unmount: () => void
  workflowId: Ref<string | null>
  status: () => AgentCrdtStatus
} {
  const workflowId = ref(initialWorkflowId)
  let readStatus!: () => AgentCrdtStatus
  const host = defineComponent({
    setup() {
      const { status } = useAgentCrdtFollower(workflowId, graphMutations)
      readStatus = () => status.value as AgentCrdtStatus
      return () => null
    }
  })
  const { unmount } = render(host)
  return { unmount, workflowId, status: readStatus }
}

describe('useAgentCrdtFollower production subscription composition', () => {
  beforeEach(() => {
    sessionStorage.clear()
    apiState.send.mockClear()
  })

  it('preserves a restored same-document subscription through acknowledgement', async () => {
    vi.useFakeTimers()
    const initial = mountFollower('doc-a')
    dispatchServerFrame('doc_subscribed', {
      workflow_id: 'doc-a',
      ok: true,
      seq: 1
    })
    initial.unmount()
    apiState.send.mockClear()

    const restored = mountFollower(null)
    expect(framesSent()).toEqual([
      expect.objectContaining({
        type: 'doc_subscribe',
        data: expect.objectContaining({ workflow_id: 'doc-a' })
      })
    ])
    dispatchServerFrame('doc_subscribed', {
      workflow_id: 'doc-a',
      ok: true,
      seq: 1
    })
    apiState.send.mockClear()

    restored.workflowId.value = 'doc-a'
    await nextTick()

    expect(restored.status().connected).toBe(true)
    expect(framesSent()).toEqual([])

    vi.advanceTimersByTime(STALE_AFTER_MS)
    expect(framesSent()).toEqual([
      expect.objectContaining({
        type: 'doc_subscribe',
        data: expect.objectContaining({ workflow_id: 'doc-a' })
      })
    ])
    expect(framesSent()).not.toContainEqual(
      expect.objectContaining({ type: 'doc_ops' })
    )
    apiState.send.mockClear()

    restored.workflowId.value = 'doc-b'
    await nextTick()

    expect(restored.status()).toMatchObject({
      connected: false,
      workflowId: 'doc-b'
    })
    expect(framesSent()).toEqual([
      expect.objectContaining({
        type: 'doc_unsubscribe',
        data: expect.objectContaining({ workflow_id: 'doc-a' })
      }),
      expect.objectContaining({
        type: 'doc_subscribe',
        data: expect.objectContaining({ workflow_id: 'doc-b' })
      })
    ])
    restored.unmount()
  })
})
