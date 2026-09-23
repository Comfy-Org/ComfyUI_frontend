import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick, readonly, ref } from 'vue'

import { testFirebaseUser } from './__fixtures__/workshopSessionFakes'
let { useWorkshopAuthFlag } = await import('../scripts/posthog')
let { workshopIdentity, workshopSessionClient, subscribeAuthRefreshTelemetry } =
  await import('./workshop-account')
import type { WorkshopSession } from './workshop-session-state'

const SIGNED_OUT = {
  phase: 'signed-out',
  user: null,
  session: undefined,
  settled: false
} as const

type Snapshot = ReturnType<typeof workshopSessionClient.getSnapshot>
const subscribers = new Set<(snapshot: Snapshot) => void>()
let emittedSnapshot: Snapshot
let liveSnapshot: Snapshot

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-account'))

const bootSession: WorkshopSession = {
  token: 'jwt',
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 3_600_000,
  uid: 'user-1',
  workspace: { id: 'ws', name: 'Personal', type: 'personal' },
  role: 'owner'
}

const authenticatedSnapshot: Snapshot = {
  phase: 'authenticated',
  user: testFirebaseUser({ uid: 'user-1' }),
  session: bootSession
}

beforeEach(async () => {
  vi.resetModules()
  ;({ useWorkshopAuthFlag } = await import('../scripts/posthog'))
  ;({ workshopIdentity, workshopSessionClient, subscribeAuthRefreshTelemetry } =
    await import('./workshop-account'))

  const flag = ref(true)
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(flag))
  onTestFinished(async () => {
    flag.value = false
    await nextTick()
  })
  window.localStorage.removeItem('workshop:workspace')
  subscribers.clear()
  emittedSnapshot = SIGNED_OUT
  liveSnapshot = SIGNED_OUT
  vi.mocked(workshopSessionClient.getSnapshot).mockImplementation(
    () => liveSnapshot
  )
  vi.mocked(workshopSessionClient.subscribe).mockImplementation((listener) => {
    subscribers.add(listener)
    listener(emittedSnapshot)
    return () => {
      subscribers.delete(listener)
    }
  })
})

describe('useWorkshopSession initialization failure', () => {
  it('cleans up and retries on the next use instead of latching the failure', async () => {
    vi.mocked(workshopIdentity.activate).mockRejectedValueOnce(
      new Error('activate exploded')
    )
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionModule = await import('./workshop-session-state')

    sessionModule.useWorkshopSession()
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())
    expect(
      subscribers.size,
      'a partial subscription from the failed attempt must not stay installed'
    ).toBe(0)

    sessionModule.useWorkshopSession()

    await vi.waitFor(() =>
      expect(
        vi.mocked(workshopIdentity.activate),
        'the latch must reopen so a later caller retries the activation'
      ).toHaveBeenCalledTimes(2)
    )
    expect(subscribers.size).toBe(1)
    errorSpy.mockRestore()
  })

  it('abandons an in-flight workspace restore when a begin step fails after activation', async () => {
    // A remembered workspace that differs from the boot session makes the
    // synchronous authenticated emit capture a restore handle mid-begin.
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    emittedSnapshot = authenticatedSnapshot
    liveSnapshot = authenticatedSnapshot
    let finishRestore!: (
      value: Awaited<ReturnType<typeof workshopSessionClient.remint>>
    ) => void
    vi.mocked(workshopSessionClient.remint).mockImplementation(
      () => new Promise((resolve) => (finishRestore = resolve))
    )
    vi.mocked(subscribeAuthRefreshTelemetry).mockImplementation(() => {
      throw new Error('telemetry exploded')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionModule = await import('./workshop-session-state')

    const session = sessionModule.useWorkshopSession()
    vi.mocked(workshopIdentity.deactivate).mockClear()
    await vi.waitFor(() =>
      expect(vi.mocked(workshopSessionClient.remint)).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())

    // The restore's re-mint settles only now, after begin threw and abandoned.
    finishRestore({ status: 'error', code: 'TOKEN_EXCHANGE_FAILED' })
    await new Promise((resolve) => setTimeout(resolve))

    expect(
      session.session.value,
      'a restore captured before begin threw must not publish after teardown'
    ).toBeUndefined()
    expect(session.signedIn.value).toBe(false)
    expect(
      vi.mocked(workshopIdentity.deactivate),
      'the failed attempt reaches deactivate(); the integration suite pins the storage effect'
    ).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })
})
