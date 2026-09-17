import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopSession } from './workshop-session-state'

const SIGNED_OUT = {
  phase: 'signed-out',
  user: null,
  session: undefined,
  settled: false
} as const

const mocks = vi.hoisted(() => ({
  attachIdentity: vi.fn<() => () => void>(),
  remint: vi.fn(),
  subscribers: new Set<(snapshot: unknown) => void>(),
  emittedSnapshot: undefined as unknown,
  liveSnapshot: undefined as unknown
}))

vi.mock<unknown>(import('../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  return {
    identifyWorkshopUser: vi.fn(),
    useWorkshopAuthFlag: () => flag
  }
})

vi.mock<unknown>(import('./workshop-firebase'), async () => {
  const { createTestIdentity } = await import('@comfyorg/account-core/testing')
  return {
    workshopIdentity: createTestIdentity({
      onUserChanged: () => () => undefined
    }),
    signOutWorkshop: vi.fn()
  }
})

vi.mock<unknown>(import('./workshop-account'), () => ({
  workshopSessionClient: {
    subscribe: (listener: (snapshot: unknown) => void) => {
      mocks.subscribers.add(listener)
      listener(mocks.emittedSnapshot)
      return () => mocks.subscribers.delete(listener)
    },
    attachIdentity: mocks.attachIdentity,
    ensureFresh: vi.fn(),
    remint: mocks.remint,
    clearStoredCredential: vi.fn(),
    getSnapshot: () => mocks.liveSnapshot,
    getToken: vi.fn()
  },
  subscribeAuthRefreshTelemetry: () => () => undefined
}))

const bootSession: WorkshopSession = {
  token: 'jwt',
  permissions: ['workspace:read'],
  expiresAt: Date.now() + 3_600_000,
  uid: 'user-1',
  workspace: { id: 'ws', name: 'Personal', type: 'personal' },
  role: 'owner'
}

const authenticatedSnapshot = {
  phase: 'authenticated',
  user: { uid: 'user-1' },
  session: bootSession
}

beforeEach(() => {
  vi.resetModules()
  window.localStorage.removeItem('workshop:workspace')
  mocks.subscribers.clear()
  mocks.attachIdentity.mockReset()
  mocks.remint.mockReset()
  mocks.emittedSnapshot = SIGNED_OUT
  mocks.liveSnapshot = SIGNED_OUT
})

describe('useWorkshopSession initialization failure', () => {
  it('cleans up and retries on the next use instead of latching the failure', async () => {
    mocks.attachIdentity
      .mockImplementationOnce(() => {
        throw new Error('attach exploded')
      })
      .mockImplementation(() => () => undefined)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionModule = await import('./workshop-session-state')

    sessionModule.useWorkshopSession()
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())
    expect(
      mocks.subscribers.size,
      'a partial subscription from the failed attempt must not stay installed'
    ).toBe(0)

    sessionModule.useWorkshopSession()

    await vi.waitFor(() =>
      expect(
        mocks.attachIdentity,
        'the latch must reopen so a later caller retries the attachment'
      ).toHaveBeenCalledTimes(2)
    )
    expect(mocks.subscribers.size).toBe(1)
    errorSpy.mockRestore()
  })

  it('abandons an in-flight workspace restore captured before begin threw', async () => {
    // A remembered workspace that differs from the boot session makes the
    // synchronous authenticated emit capture a restore handle mid-begin.
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    mocks.emittedSnapshot = authenticatedSnapshot
    mocks.liveSnapshot = authenticatedSnapshot
    let finishRestore!: (value: { status: string; code: string }) => void
    mocks.remint.mockImplementation(
      () => new Promise((resolve) => (finishRestore = resolve))
    )
    mocks.attachIdentity.mockImplementation(() => {
      throw new Error('attach exploded')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sessionModule = await import('./workshop-session-state')

    const session = sessionModule.useWorkshopSession()
    await vi.waitFor(() => expect(mocks.remint).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())

    // The restore's re-mint settles only now, after begin threw and abandoned.
    finishRestore({ status: 'error', code: 'TOKEN_EXCHANGE_FAILED' })
    await new Promise((resolve) => setTimeout(resolve))

    expect(
      session.session.value,
      'a restore captured before begin threw must not publish after teardown'
    ).toBeUndefined()
    expect(session.signedIn.value).toBe(false)
    errorSpy.mockRestore()
  })
})
