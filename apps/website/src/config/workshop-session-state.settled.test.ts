import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    flag: undefined as { value: boolean } | undefined,
    listeners: new Set<(snapshot: unknown) => void>(),
    snapshot: {
      phase: 'pending',
      user: null,
      session: undefined
    } as unknown,
    activate: vi.fn(async () => undefined),
    publish(next: unknown) {
      state.snapshot = next
      state.listeners.forEach((listener) => listener(next))
    }
  }
  return state
})

vi.mock<unknown>(import('../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
  return {
    identifyWorkshopUser: vi.fn(),
    useWorkshopAuthFlag: () => flag
  }
})

vi.mock<unknown>(import('./workshop-account'), () => ({
  workshopSessionClient: {
    subscribe: (listener: (snapshot: unknown) => void) => {
      h.listeners.add(listener)
      listener(h.snapshot)
      return () => h.listeners.delete(listener)
    },
    ensureFresh: vi.fn(),
    remint: vi.fn(),
    clearStoredCredential: vi.fn(),
    getSnapshot: () => h.snapshot,
    getToken: vi.fn()
  },
  workshopIdentity: { activate: h.activate, deactivate: vi.fn() },
  subscribeAuthRefreshTelemetry: () => () => undefined
}))

beforeEach(() => {
  vi.resetModules()
  h.listeners.clear()
})

describe('useWorkshopSession settled', () => {
  it('mirrors the client: settled only once Firebase has delivered the restored user or none', async () => {
    const mod = await import('./workshop-session-state')
    const s = mod.useWorkshopSession()
    await vi.waitFor(() => expect(h.activate).toHaveBeenCalledOnce())

    expect(
      s.settled.value,
      'before Firebase answers, nobody knows whether a user is signed in'
    ).toBe(false)

    h.publish({
      phase: 'signed-out',
      user: null,
      session: undefined
    })
    expect(s.settled.value).toBe(true)

    h.flag!.value = false
    await vi.waitFor(() => expect(s.settled.value).toBe(false))
  })
})
