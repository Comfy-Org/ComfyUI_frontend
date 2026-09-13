// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import type { WorkshopSession } from './workshop-session-state'

const h = vi.hoisted(() => {
  const state = {
    settled: undefined as { value: boolean } | undefined,
    setSession: undefined as
      | ((session: WorkshopSession | undefined) => void)
      | undefined,
    setUser: undefined as ((uid: string | null) => void) | undefined,
    setSessionFailure: undefined as
      | ((code: string | undefined) => void)
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
  const user = ref<{ readonly uid: string } | null>({ uid: 'user-1' })
  const sessionFailure = ref<{ readonly code: string } | undefined>(undefined)
  const settled = ref(true)
  h.setSession = (next) => {
    session.value = next
  }
  h.settled = settled
  h.setUser = (uid) => {
    user.value = uid === null ? null : { uid }
  }
  h.setSessionFailure = (code) => {
    sessionFailure.value = code === undefined ? undefined : { code }
  }
  return {
    useWorkshopSession: () => ({
      user,
      session,
      sessionFailure,
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

function liveSession(token = 'jwt', workspaceId = 'ws-1'): WorkshopSession {
  return {
    token,
    uid: 'user-1',
    permissions: ['workspace:read'],
    expiresAt: Date.now() + 60 * 60 * 1000,
    workspace: { id: workspaceId, name: 'Personal', type: 'personal' },
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
  h.setUser?.('user-1')
  h.setSessionFailure?.(undefined)
  if (h.settled) h.settled.value = true
  h.refresh.mockClear()
  h.reset.mockClear()
  h.reset.mockImplementation(() => h.publish({ status: 'unknown' }))
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

  it('hides the previous workspace balance before the new wallet loads', async () => {
    const mod = await importFresh()
    const { balance } = mod.useWorkshopCredits()
    h.setSession?.(liveSession('token-a'))
    h.publish({ status: 'ok', cents: 100 })
    await vi.waitFor(() => expect(balance.value.status).toBe('ok'))

    h.setSession?.(liveSession('token-b'))

    await vi.waitFor(() =>
      expect(
        balance.value,
        'a token rotation changes wallet scope; the old balance must disappear synchronously with that scope change'
      ).toEqual({ status: 'unknown' })
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

describe('watchForTopUp', () => {
  it('declares success only after the scoped balance increases', async () => {
    vi.useFakeTimers()
    const mod = await importFresh()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    h.publish({ status: 'ok', cents: 0 })
    const state = mod.useTopUpWatch()

    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    expect(state.value).toEqual({
      status: 'waiting',
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    h.publish({ status: 'ok', cents: 50 })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(state.value).toMatchObject({
      status: 'landed',
      previousCredits: 100,
      newCredits: 106
    })
  })

  it('does not describe a return with no balance change as success', async () => {
    vi.useFakeTimers()
    const mod = await importFresh()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    h.publish({ status: 'ok', cents: 0 })
    const state = mod.useTopUpWatch()

    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    await vi.advanceTimersByTimeAsync(120_000)

    expect(state.value).toEqual({
      status: 'unresolved',
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
  })

  it('stops waiting when workspace recovery remains pending', async () => {
    vi.useFakeTimers()
    const mod = await importFresh()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    h.publish({ status: 'ok', cents: 0 })
    h.setSession?.(undefined)
    const state = mod.useTopUpWatch()
    h.refresh.mockClear()

    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    await vi.advanceTimersByTimeAsync(120_000)

    expect(state.value).toEqual({
      status: 'unresolved',
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    expect(h.refresh).not.toHaveBeenCalled()
  })

  it('retires a watch when the active workspace changes', async () => {
    vi.useFakeTimers()
    const mod = await importFresh()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    h.publish({ status: 'ok', cents: 0 })
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    h.setSession?.(liveSession('other-token', 'ws-2'))
    await vi.advanceTimersByTimeAsync(5_000)

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a landed receipt before another workspace can display it', async () => {
    vi.useFakeTimers()
    const mod = await importFresh()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    h.publish({ status: 'ok', cents: 0 })
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    h.publish({ status: 'ok', cents: 50 })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(state.value.status).toBe('landed')

    h.setSession?.(liveSession('team-token', 'ws-2'))
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a watch when session recovery has permanently failed', async () => {
    const mod = await importFresh()
    onTestFinished(() => mod.clearTopUpWatch())
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    h.setSession?.(undefined)
    h.setSessionFailure?.('ACCESS_DENIED')
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a watch when the session lifecycle stops', async () => {
    const mod = await importFresh()
    onTestFinished(() => mod.clearTopUpWatch())
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    if (h.settled) h.settled.value = false
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a receipt as soon as the signed-in identity changes', async () => {
    const mod = await importFresh()
    onTestFinished(() => mod.clearTopUpWatch())
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    h.setSession?.(undefined)
    h.setUser?.('user-2')
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('does not settle from a different wallet that arrives during refresh', async () => {
    vi.useFakeTimers()
    const mod = await importFresh()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    h.setSession?.(liveSession())
    await nextTick()
    h.publish({ status: 'ok', cents: 0 })
    h.refresh.mockClear()
    let finishRefresh!: () => void
    h.refresh.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishRefresh = resolve))
    )
    const state = mod.useTopUpWatch()

    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    await vi.waitFor(() => expect(h.refresh).toHaveBeenCalledOnce())
    h.setSession?.(liveSession('other-token', 'ws-2'))
    h.publish({ status: 'ok', cents: 1_000 })
    finishRefresh()
    await Promise.resolve()

    expect(state.value).toEqual({ status: 'idle' })
  })
})
