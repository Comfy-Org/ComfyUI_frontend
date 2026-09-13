/**
 * FEC-1: the malformed-ack retry, exercised through the REAL client, bridge and
 * composable. The unit suites either module-mock `LayoutFollowerBridge`
 * (useAgentCrdtFollower.test.ts) or drive `bridge.reconcile()` by hand
 * (followerSubscription.test.ts), so neither can observe whether the frame the
 * bridge re-dispatches actually reaches the composable's failure branch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { render } from '@testing-library/vue'

import type { MutationsForTarget } from './ecsFollowerAdapter'
import type { AgentCrdtStatus } from './useAgentCrdtFollower'

const WORKFLOW_ID = 'wf-1'

const apiState = vi.hoisted(() => {
  const frames = new EventTarget()
  return {
    frames,
    sent: [] as string[],
    api: {
      socket: {
        readyState: 1,
        send: (frame: string) => apiState.sent.push(frame)
      },
      addCustomEventListener: (type: string, listener: EventListener) =>
        frames.addEventListener(type, listener),
      removeCustomEventListener: (type: string, listener: EventListener) =>
        frames.removeEventListener(type, listener),
      addEventListener: (type: string, listener: EventListener) =>
        frames.addEventListener(type, listener),
      removeEventListener: (type: string, listener: EventListener) =>
        frames.removeEventListener(type, listener)
    }
  }
})

vi.mock<unknown>(import('@/scripts/api'), () => ({ api: apiState.api }))
vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { graph: null, canvas: null }
}))

import { useAgentCrdtFollower } from './useAgentCrdtFollower'

function framesOfType(type: string): unknown[] {
  return apiState.sent
    .map((frame) => JSON.parse(frame) as { type: string })
    .filter((frame) => frame.type === type)
}

function deliver(type: string, data: unknown): void {
  apiState.frames.dispatchEvent(new CustomEvent(type, { detail: data }))
}

function mountFollower(): {
  unmount: () => void
  status: () => AgentCrdtStatus
} {
  let exposedStatus!: () => AgentCrdtStatus
  const host = defineComponent({
    setup() {
      const { status } = useAgentCrdtFollower(
        ref(WORKFLOW_ID),
        {} as MutationsForTarget
      )
      exposedStatus = () => status.value as AgentCrdtStatus
      return () => null
    }
  })
  const { unmount } = render(host)
  return { unmount, status: exposedStatus }
}

describe('FEC-1 — a malformed subscription ack reaches the composable as a failure', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    apiState.sent.length = 0
  })

  it('retries the subscribe and never reports the deaf follower as connected', () => {
    const { unmount, status } = mountFollower()
    expect(framesOfType('doc_subscribe')).toHaveLength(1)

    deliver('doc_subscribed', { v: 1, workflow_id: WORKFLOW_ID, ok: true })

    expect(status().connected).toBe(false)
    expect(sessionStorage.getItem('Comfy.Agent.CrdtDocId')).toBeNull()

    vi.advanceTimersByTime(500)
    expect(framesOfType('doc_subscribe')).toHaveLength(2)

    deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })
    expect(status().connected).toBe(true)
    unmount()
  })

  it('releases the subscription the server accepted before retrying it', () => {
    const { unmount } = mountFollower()

    deliver('doc_subscribed', { v: 1, workflow_id: WORKFLOW_ID, ok: true })
    expect(framesOfType('doc_unsubscribe')).toHaveLength(1)

    unmount()
  })

  it('sends no unsubscribe when the server refused the subscribe', () => {
    const { unmount } = mountFollower()

    deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      code: 'forbidden'
    })
    expect(framesOfType('doc_unsubscribe')).toHaveLength(0)

    unmount()
  })
})
