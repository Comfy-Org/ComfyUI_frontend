// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopSession } from './workshop-session-state'

const h = vi.hoisted(() => {
  const state = {
    settled: undefined as { value: boolean } | undefined,
    setSession: undefined as
      | ((session: WorkshopSession | undefined) => void)
      | undefined,
    billingState: { status: 'unknown' } as unknown,
    listeners: new Set<(state: unknown) => void>(),
    refresh: vi.fn<(options?: { readonly force?: boolean }) => Promise<void>>(
      async () => {}
    ),
    reset: vi.fn(),
    publish(next: unknown) {
      state.billingState = next
      state.listeners.forEach((listener) => listener(next))
    }
  }
  return state
})

vi.mock<unknown>(import('./workshop-session-state'), async () => {
  const { computed, ref } = await import('vue')
  const session = ref<WorkshopSession | undefined>(undefined)
  const settled = ref(true)
  h.setSession = (next) => {
    session.value = next
  }
  h.settled = settled
  return {
    useWorkshopSession: () => ({
      session,
      settled,
      signedIn: computed(() => session.value !== undefined),
      remint: vi.fn()
    })
  }
})

vi.mock<unknown>(import('./workshop-account'), () => ({
  workshopBalanceReader: {
    getState: () => h.billingState,
    subscribe: (listener: (state: unknown) => void) => {
      h.listeners.add(listener)
      listener(h.billingState)
      return () => h.listeners.delete(listener)
    },
    refresh: h.refresh,
    reset: h.reset
  }
}))

function liveSession(token = 'jwt'): WorkshopSession {
  return {
    token,
    uid: 'user-1',
    permissions: ['workspace:read'],
    expiresAt: Date.now() + 60 * 60 * 1000,
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner'
  }
}

async function importFresh() {
  vi.resetModules()
  return import('./workshop-credits')
}

beforeEach(() => {
  h.listeners.clear()
  h.billingState = { status: 'unknown' }
  h.setSession?.(undefined)
})

describe('balanceToCredits', () => {
  it('treats the backend values as cents despite their _micros names', async () => {
    const mod = await importFresh()
    expect(
      mod.balanceToCredits(3_000_000),
      'the platform fixtures annotate effective_balance_micros: 3_000_000 as ~6.3M credits'
    ).toBe(6_330_000)
    expect(mod.balanceToCredits(100)).toBe(211)
    expect(mod.balanceToCredits(0)).toBe(0)
  })
})

describe('useWorkshopCredits', () => {
  it('converts the client cents into chip credits', async () => {
    const mod = await importFresh()
    const { balance } = mod.useWorkshopCredits()

    h.publish({ status: 'ok', cents: 1234 })

    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: mod.balanceToCredits(1234)
      })
    )
  })

  it('passes error states through unconverted', async () => {
    const mod = await importFresh()
    const { balance } = mod.useWorkshopCredits()

    h.publish({ status: 'error', unauthorized: true })

    await vi.waitFor(() =>
      expect(balance.value).toEqual({ status: 'error', unauthorized: true })
    )
  })

  it('forwards refresh calls to the billing client', async () => {
    const mod = await importFresh()

    await mod.refreshWorkshopCredits({ force: true })

    expect(h.refresh).toHaveBeenCalledExactlyOnceWith({ force: true })
  })

  it('resets the client when the session goes unsettled', async () => {
    const mod = await importFresh()
    mod.useWorkshopCredits()
    const callsBefore = h.reset.mock.calls.length

    h.settled!.value = false

    await vi.waitFor(() =>
      expect(
        h.reset.mock.calls.length,
        'an unsettled session must return the chip to unknown'
      ).toBeGreaterThan(callsBefore)
    )
  })
})

describe('useWorkshopCredits start()', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('installs no focus listener while the session is unsettled', async () => {
    h.settled!.value = false
    const addSpy = vi.spyOn(window, 'addEventListener')
    const mod = await import('./workshop-credits')

    mod.useWorkshopCredits()

    expect(
      addSpy.mock.calls.some(([type]) => type === 'focus'),
      'an unsettled page must install no credits listeners'
    ).toBe(false)
    addSpy.mockRestore()
  })

  it('arms the lifecycle when the session settles after mount', async () => {
    h.settled!.value = false
    const addSpy = vi.spyOn(window, 'addEventListener')
    const mod = await import('./workshop-credits')
    mod.useWorkshopCredits()

    h.settled!.value = true

    await vi.waitFor(() =>
      expect(
        addSpy.mock.calls.some(([type]) => type === 'focus'),
        'a session that settles after mount must still arm the lifecycle'
      ).toBe(true)
    )
    addSpy.mockRestore()
  })

  it('force-refreshes when the session token rotates, never joining a doomed in-flight read', async () => {
    const mod = await importFresh()
    mod.useWorkshopCredits()
    h.setSession?.(liveSession('token-a'))
    await vi.waitFor(() => expect(h.refresh).toHaveBeenCalled())
    const forcedBefore = h.refresh.mock.calls.filter(
      ([options]) => options?.force === true
    ).length

    h.setSession?.(liveSession('token-b'))

    await vi.waitFor(() =>
      expect(
        h.refresh.mock.calls.filter(([options]) => options?.force === true)
          .length,
        'a read started under the old token is discarded by the publish guard; the rotation must issue its own'
      ).toBeGreaterThan(forcedBefore)
    )
  })

  it('force-refreshes on focus while a session is live', async () => {
    h.settled!.value = true
    const mod = await import('./workshop-credits')
    mod.useWorkshopCredits()
    h.setSession!(liveSession())
    const forcedBefore = h.refresh.mock.calls.filter(
      ([options]) => options?.force === true
    ).length

    window.dispatchEvent(new Event('focus'))

    await vi.waitFor(() =>
      expect(
        h.refresh.mock.calls.filter(([options]) => options?.force === true)
          .length,
        'refocus must force a re-read so a balance spent in another tab updates'
      ).toBeGreaterThan(forcedBefore)
    )
  })
})
