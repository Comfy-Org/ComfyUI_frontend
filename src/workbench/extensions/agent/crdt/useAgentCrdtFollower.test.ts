import { createApp, ref } from 'vue'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

const apiMock = vi.hoisted(() => {
  const events = new EventTarget()
  return {
    socket: null as {
      readyState: number
      send: (frame: string) => void
    } | null,
    addCustomEventListener(type: string, listener: EventListener): void {
      events.addEventListener(type, listener)
    },
    removeCustomEventListener(type: string, listener: EventListener): void {
      events.removeEventListener(type, listener)
    },
    addEventListener(type: string, listener: EventListener): void {
      events.addEventListener(type, listener)
    },
    removeEventListener(type: string, listener: EventListener): void {
      events.removeEventListener(type, listener)
    },
    emit(type: string, detail: unknown): void {
      events.dispatchEvent(new CustomEvent(type, { detail }))
    }
  }
})

vi.mock('@/scripts/api', () => ({ api: apiMock }))
vi.mock('@/scripts/app', () => ({ app: { graph: null } }))

import type {
  AgentCrdtStatus,
  useAgentCrdtFollower as UseAgentCrdtFollower
} from './useAgentCrdtFollower'

const WORKFLOW_ID = 'wf-refusal'
type UseFollower = typeof UseAgentCrdtFollower

let useFollower: UseFollower
let sentFrames: string[]
let mountedApp: ReturnType<typeof createApp> | null = null

beforeAll(async () => {
  localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
  useFollower = (await import('./useAgentCrdtFollower')).useAgentCrdtFollower
}, 60000)

beforeEach(() => {
  vi.useFakeTimers()
  sentFrames = []
  apiMock.socket = {
    readyState: WebSocket.OPEN,
    send: (frame) => sentFrames.push(frame)
  }
})

afterEach(() => {
  mountedApp?.unmount()
  mountedApp = null
  apiMock.socket = null
})

function mountFollower(): { status: Readonly<{ value: AgentCrdtStatus }> } {
  const workflowId = ref<string | null>(WORKFLOW_ID)
  let status!: Readonly<{ value: AgentCrdtStatus }>
  mountedApp = createApp({
    setup() {
      status = useFollower(workflowId).status
      return () => null
    }
  })
  mountedApp.mount(document.createElement('div'))
  return { status }
}

function subscribeCount(): number {
  return sentFrames.filter(
    (frame) => JSON.parse(frame).type === 'doc_subscribe'
  ).length
}

function refuse(code?: string): void {
  apiMock.emit('doc_subscribed', {
    v: 1,
    workflow_id: WORKFLOW_ID,
    ok: false,
    ...(code !== undefined && { code })
  })
}

describe('doc_subscribed refusal-code discrimination', () => {
  it('too_large stops all retries and exposes a distinct terminal status', () => {
    const { status } = mountFollower()

    refuse('too_large')
    apiMock.emit('status', {})
    vi.runAllTimers()

    expect(subscribeCount()).toBe(1)
    expect(status.value.subscriptionStatus).toBe('too_large')
    expect(status.value.refusalCode).toBe('too_large')
  })

  it.for(['unsupported', 'invalid_frame'])(
    '%s stops immediately as a permanent failure',
    (code) => {
      const { status } = mountFollower()

      refuse(code)
      apiMock.emit('status', {})
      vi.runAllTimers()

      expect(subscribeCount()).toBe(1)
      expect(status.value.subscriptionStatus).toBe('permanent_failure')
      expect(status.value.refusalCode).toBe(code)
    }
  )

  it('overloaded keeps the bounded exponential retry behavior', () => {
    const { status } = mountFollower()

    refuse('overloaded')
    expect(status.value.subscriptionStatus).toBe('retrying')
    vi.advanceTimersByTime(499)
    expect(subscribeCount()).toBe(1)
    vi.advanceTimersByTime(1)

    expect(subscribeCount()).toBe(2)
  })

  it('not_found remains transient for the FE-1901 creation race', () => {
    const { status } = mountFollower()

    refuse('not_found')
    expect(status.value.subscriptionStatus).toBe('retrying')
    vi.advanceTimersByTime(500)

    expect(subscribeCount()).toBe(2)
    expect(status.value.refusalCode).toBe('not_found')
  })
})
