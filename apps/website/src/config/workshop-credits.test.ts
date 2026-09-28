import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { testFirebaseUser } from './__fixtures__/workshopSessionFakes'
let { workshopBalanceReader } = await import('./workshop-account')
let { useWorkshopSession } = await import('./workshop-session-state')
import type { WorkshopSession } from './workshop-session-state'

type Session = ReturnType<typeof useWorkshopSession>
type Balance = ReturnType<typeof workshopBalanceReader.getState>
let settled = ref(true)
let session = ref<WorkshopSession>()
let user = ref<Session['user']['value']>(null)
let sessionFailure = ref<Session['sessionFailure']['value']>()
let billingState: Balance
const listeners = new Set<(state: Balance) => void>()

function publish(next: Balance) {
  billingState = next
  listeners.forEach((listener) => listener(next))
}

vi.mock(import('./workshop-session-state'))
vi.mock(import('./workshop-account'))

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

async function loadCredits() {
  return import('./workshop-credits')
}

beforeEach(async () => {
  vi.resetModules()
  ;({ workshopBalanceReader } = await import('./workshop-account'))
  ;({ useWorkshopSession } = await import('./workshop-session-state'))

  listeners.clear()
  billingState = { status: 'unknown' }
  session = ref()
  user = ref(testFirebaseUser({ uid: 'user-1' }))
  sessionFailure = ref()
  settled = ref(true)
  const state = useWorkshopSession()
  state.session = computed(() => session.value)
  state.user = computed(() => user.value)
  state.sessionFailure = computed(() => sessionFailure.value)
  state.settled = computed(() => settled.value)
  vi.mocked(workshopBalanceReader.getState).mockImplementation(
    () => billingState
  )
  vi.mocked(workshopBalanceReader.subscribe).mockImplementation((listener) => {
    listeners.add(listener)
    listener(billingState)
    return () => {
      listeners.delete(listener)
    }
  })
  vi.mocked(workshopBalanceReader.reset).mockImplementation(() =>
    publish({ status: 'unknown' })
  )
  onTestFinished(async () => {
    settled.value = false
    await nextTick()
  })
})

describe('balanceToCredits', () => {
  it('treats the backend values as cents despite their _micros names', async () => {
    const mod = await loadCredits()
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
    const mod = await loadCredits()
    const { balance } = mod.useWorkshopCredits()

    publish({ status: 'ok', cents: 1234 })

    await vi.waitFor(() =>
      expect(balance.value).toEqual({
        status: 'ok',
        credits: mod.balanceToCredits(1234)
      })
    )
  })

  it('passes error states through unconverted', async () => {
    const mod = await loadCredits()
    const { balance } = mod.useWorkshopCredits()

    publish({ status: 'error', unauthorized: true })

    await vi.waitFor(() =>
      expect(balance.value).toEqual({ status: 'error', unauthorized: true })
    )
  })

  it('forwards refresh calls to the billing client', async () => {
    const mod = await loadCredits()

    await mod.refreshWorkshopCredits({ force: true })

    expect(
      vi.mocked(workshopBalanceReader.refresh)
    ).toHaveBeenCalledExactlyOnceWith({ force: true })
  })

  it('resets the client when the session goes unsettled', async () => {
    const mod = await loadCredits()
    mod.useWorkshopCredits()
    const callsBefore = vi.mocked(workshopBalanceReader.reset).mock.calls.length

    settled.value = false

    await vi.waitFor(() =>
      expect(
        vi.mocked(workshopBalanceReader.reset).mock.calls.length,
        'an unsettled session must return the chip to unknown'
      ).toBeGreaterThan(callsBefore)
    )
  })
})

describe('useWorkshopCredits start()', () => {
  it('installs no focus listener while the session is unsettled', async () => {
    settled.value = false
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
    settled.value = false
    const addSpy = vi.spyOn(window, 'addEventListener')
    const mod = await import('./workshop-credits')
    mod.useWorkshopCredits()

    settled.value = true

    await vi.waitFor(() =>
      expect(
        addSpy.mock.calls.some(([type]) => type === 'focus'),
        'a session that settles after mount must still arm the lifecycle'
      ).toBe(true)
    )
    addSpy.mockRestore()
  })

  it('force-refreshes when the session token rotates, never joining a doomed in-flight read', async () => {
    const mod = await loadCredits()
    mod.useWorkshopCredits()
    session.value = liveSession('token-a')
    await vi.waitFor(() =>
      expect(vi.mocked(workshopBalanceReader.refresh)).toHaveBeenCalled()
    )
    const forcedBefore = vi
      .mocked(workshopBalanceReader.refresh)
      .mock.calls.filter(([options]) => options?.force === true).length

    session.value = liveSession('token-b')

    await vi.waitFor(() =>
      expect(
        vi
          .mocked(workshopBalanceReader.refresh)
          .mock.calls.filter(([options]) => options?.force === true).length,
        'a read started under the old token is discarded by the publish guard; the rotation must issue its own'
      ).toBeGreaterThan(forcedBefore)
    )
  })

  it('hides the previous workspace balance before the new wallet loads', async () => {
    const mod = await loadCredits()
    const { balance } = mod.useWorkshopCredits()
    session.value = liveSession('token-a')
    publish({ status: 'ok', cents: 100 })
    await vi.waitFor(() => expect(balance.value.status).toBe('ok'))

    session.value = liveSession('token-b')

    await vi.waitFor(() =>
      expect(
        balance.value,
        'a token rotation changes wallet scope; the old balance must disappear synchronously with that scope change'
      ).toEqual({ status: 'unknown' })
    )
  })

  it('force-refreshes on focus while a session is live', async () => {
    settled.value = true
    const mod = await import('./workshop-credits')
    mod.useWorkshopCredits()
    session.value = liveSession()
    const forcedBefore = vi
      .mocked(workshopBalanceReader.refresh)
      .mock.calls.filter(([options]) => options?.force === true).length

    window.dispatchEvent(new Event('focus'))

    await vi.waitFor(() =>
      expect(
        vi
          .mocked(workshopBalanceReader.refresh)
          .mock.calls.filter(([options]) => options?.force === true).length,
        'refocus must force a re-read so a balance spent in another tab updates'
      ).toBeGreaterThan(forcedBefore)
    )
  })
})

describe('watchForTopUp', () => {
  it('declares success only after the scoped balance increases', async () => {
    vi.useFakeTimers()
    const mod = await loadCredits()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    publish({ status: 'ok', cents: 0 })
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

    publish({ status: 'ok', cents: 50 })
    await vi.advanceTimersByTimeAsync(5_000)

    expect(state.value).toMatchObject({
      status: 'landed',
      previousCredits: 100,
      newCredits: 106
    })
  })

  it('does not describe a return with no balance change as success', async () => {
    vi.useFakeTimers()
    const mod = await loadCredits()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    publish({ status: 'ok', cents: 0 })
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
    const mod = await loadCredits()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    publish({ status: 'ok', cents: 0 })
    session.value = undefined
    const state = mod.useTopUpWatch()
    vi.mocked(workshopBalanceReader.refresh).mockClear()

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
    expect(vi.mocked(workshopBalanceReader.refresh)).not.toHaveBeenCalled()
  })

  it('retires a watch when the active workspace changes', async () => {
    vi.useFakeTimers()
    const mod = await loadCredits()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    publish({ status: 'ok', cents: 0 })
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    session.value = liveSession('other-token', 'ws-2')
    await vi.advanceTimersByTimeAsync(5_000)

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a landed receipt before another workspace can display it', async () => {
    vi.useFakeTimers()
    const mod = await loadCredits()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    publish({ status: 'ok', cents: 0 })
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    publish({ status: 'ok', cents: 50 })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(state.value.status).toBe('landed')

    session.value = liveSession('team-token', 'ws-2')
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a watch when session recovery has permanently failed', async () => {
    const mod = await loadCredits()
    onTestFinished(() => mod.clearTopUpWatch())
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    session.value = undefined
    sessionFailure.value = { status: 'error', code: 'ACCESS_DENIED' }
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a watch when the session lifecycle stops', async () => {
    const mod = await loadCredits()
    onTestFinished(() => mod.clearTopUpWatch())
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    settled.value = false
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('retires a receipt as soon as the signed-in identity changes', async () => {
    const mod = await loadCredits()
    onTestFinished(() => mod.clearTopUpWatch())
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    const state = mod.useTopUpWatch()
    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })

    session.value = undefined
    user.value = testFirebaseUser({ uid: 'user-2' })
    await nextTick()

    expect(state.value).toEqual({ status: 'idle' })
  })

  it('does not settle from a different wallet that arrives during refresh', async () => {
    vi.useFakeTimers()
    const mod = await loadCredits()
    onTestFinished(() => {
      mod.clearTopUpWatch()
      vi.useRealTimers()
    })
    mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    publish({ status: 'ok', cents: 0 })
    vi.mocked(workshopBalanceReader.refresh).mockClear()
    let finishRefresh!: () => void
    vi.mocked(workshopBalanceReader.refresh).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishRefresh = resolve))
    )
    const state = mod.useTopUpWatch()

    mod.watchForTopUp({
      uid: 'user-1',
      workspaceId: 'ws-1',
      workspaceName: 'Personal',
      previousCredits: 100
    })
    await vi.waitFor(() =>
      expect(vi.mocked(workshopBalanceReader.refresh)).toHaveBeenCalledOnce()
    )
    session.value = liveSession('other-token', 'ws-2')
    publish({ status: 'ok', cents: 1_000 })
    finishRefresh()
    await Promise.resolve()

    expect(state.value).toEqual({ status: 'idle' })
  })
})

describe('markWorkshopCreditsDirty', () => {
  async function dirtyChip(reads: number[]) {
    vi.useFakeTimers()
    const mod = await loadCredits()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { balance } = mod.useWorkshopCredits()
    session.value = liveSession()
    await nextTick()
    publish({ status: 'ok', cents: 1000 })
    const pending = [...reads]
    const refresh = vi.mocked(workshopBalanceReader.refresh)
    refresh.mockClear()
    refresh.mockImplementation(async () => {
      const cents = pending.length > 1 ? pending.shift() : pending[0]
      publish({ status: 'ok', cents: cents ?? 1000 })
    })
    return { mod, balance, refresh }
  }

  it('re-syncs until a late charge shows, then stops', async () => {
    const { mod, balance, refresh } = await dirtyChip([1000, 1000, 900])

    mod.markWorkshopCreditsDirty()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(balance.value).toEqual({
      status: 'ok',
      credits: mod.balanceToCredits(900)
    })
    expect(refresh).toHaveBeenCalledTimes(3)
    expect(refresh).toHaveBeenCalledWith({ force: true })
  })

  it('keeps re-syncing for a second run that finished before the first was charged', async () => {
    const { mod, balance, refresh } = await dirtyChip([1000, 900, 900, 800])

    mod.markWorkshopCreditsDirty()
    await vi.advanceTimersByTimeAsync(0)
    mod.markWorkshopCreditsDirty()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(balance.value).toEqual({
      status: 'ok',
      credits: mod.balanceToCredits(800)
    })
    expect(refresh).toHaveBeenCalledTimes(4)
  })

  it('does not take a top-up during the re-sync for the charge', async () => {
    const { mod, balance } = await dirtyChip([1500, 1500, 1400])

    mod.markWorkshopCreditsDirty()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(balance.value).toEqual({
      status: 'ok',
      credits: mod.balanceToCredits(1400)
    })
  })

  it('gives up after about five minutes when the balance never moves', async () => {
    const { mod, refresh } = await dirtyChip([])

    mod.markWorkshopCreditsDirty()
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    const readsWithinWindow = refresh.mock.calls.length
    await vi.advanceTimersByTimeAsync(60 * 60_000)

    expect(readsWithinWindow).toBeGreaterThan(5)
    expect(refresh.mock.calls.length - readsWithinWindow).toBeLessThanOrEqual(2)
  })

  it('stops re-syncing once the workspace changes', async () => {
    const { mod, refresh } = await dirtyChip([])

    mod.markWorkshopCreditsDirty()
    await vi.advanceTimersByTimeAsync(0)
    session.value = liveSession('token-b', 'ws-2')
    await nextTick()
    refresh.mockClear()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(refresh).not.toHaveBeenCalled()
  })
})
