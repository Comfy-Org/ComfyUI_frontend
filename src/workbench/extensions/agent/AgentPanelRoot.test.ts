import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

// A controllable stand-in for the host api: an EventTarget with a swappable socket, the
// exact surface the reconnecting event source binds to. Emitting a malformed agent frame
// through its socket is the one seam that drives a session notice at mount without a live
// backend, which is what FIX 5 forwards to the toast. Hoisted so the api mock factory can
// close over the same listener map the test emits through.
const socket = vi.hoisted(() => {
  type Listener = (event?: { data: unknown }) => void
  const listeners = new Map<string, Set<Listener>>()
  const fake = {
    readyState: 1,
    addEventListener(type: string, listener: Listener) {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener)
    }
  }
  const emit = (type: string, event?: { data: unknown }): void => {
    for (const listener of listeners.get(type) ?? []) listener(event)
  }
  const clear = (): void => listeners.clear()
  return { fake, emit, clear }
})

vi.mock('@/scripts/api', () => {
  const target = new EventTarget()
  return {
    api: {
      socket: socket.fake,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target)
    }
  }
})

vi.mock('@/scripts/app', () => ({ app: { loadGraphData: vi.fn() } }))

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ workspaceToken: undefined })
}))

import AgentPanelRoot from './AgentPanelRoot.vue'

describe('AgentPanelRoot session notices', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    socket.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards a session notice to the host toast as an error', async () => {
    render(AgentPanelRoot, { global: { plugins: [i18n] } })
    const toast = useToastStore()

    // A malformed agent_message_done with no readable message_id makes the session push an
    // error notice (i18n agent.malformedEvent). The root watch must surface it as a toast.
    socket.emit('message', {
      data: JSON.stringify({ type: 'agent_message_done', data: {} })
    })
    await nextTick()

    expect(toast.messagesToAdd).toHaveLength(1)
    expect(toast.messagesToAdd[0]).toMatchObject({
      severity: 'error',
      summary: i18n.global.t('agent.malformedEvent')
    })
  })
})
