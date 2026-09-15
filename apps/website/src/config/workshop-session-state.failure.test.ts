import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopSession } from './workshop-session-state'

const SIGNED_OUT = {
  phase: 'signed-out',
  user: null,
  session: undefined,
  settled: false
} as const

const h = vi.hoisted(() => ({
  attachIdentity: vi.fn<() => () => void>(),
  remint: vi.fn(),
  subscribers: new Set<(snapshot: unknown) => void>(),
  emit: undefined as unknown,
  live: undefined as unknown
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
  const { createTestIdentity } = await import('@comfyorg/account/testing')
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
      h.subscribers.add(listener)
      listener(h.emit)
      return () => h.subscribers.delete(listener)
    },
    attachIdentity: h.attachIdentity,
    ensureFresh: vi.fn(),
    remint: h.remint,
    clearStoredCredential: vi.fn(),
    getSnapshot: () => h.live,
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

const authenticated = {
  phase: 'authenticated',
  user: { uid: 'user-1' },
  session: bootSession
}

beforeEach(() => {
  vi.resetModules()
  window.localStorage.removeItem('workshop:workspace')
  h.subscribers.clear()
  h.attachIdentity.mockReset()
  h.remint.mockReset()
  h.emit = SIGNED_OUT
  h.live = SIGNED_OUT
})

describe('useWorkshopSession initialization failure', () => {
  it('cleans up and retries on the next use instead of latching the failure', async () => {
    h.attachIdentity
      .mockImplementationOnce(() => {
        throw new Error('attach exploded')
      })
      .mockImplementation(() => () => undefined)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await import('./workshop-session-state')

    mod.useWorkshopSession()
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())
    expect(
      h.subscribers.size,
      'a partial subscription from the failed attempt must not stay installed'
    ).toBe(0)

    mod.useWorkshopSession()

    await vi.waitFor(() =>
      expect(
        h.attachIdentity,
        'the latch must reopen so a later caller retries the attachment'
      ).toHaveBeenCalledTimes(2)
    )
    expect(h.subscribers.size).toBe(1)
    errorSpy.mockRestore()
  })

  it('abandons an in-flight workspace restore captured before begin threw', async () => {
    // A remembered workspace that differs from the boot session makes the
    // synchronous authenticated emit capture a restore handle mid-begin.
    window.localStorage.setItem(
      'workshop:workspace',
      JSON.stringify({ uid: 'user-1', workspaceId: 'team-9' })
    )
    h.emit = authenticated
    h.live = authenticated
    let finishRestore!: (value: { status: string; code: string }) => void
    h.remint.mockImplementation(
      () => new Promise((resolve) => (finishRestore = resolve))
    )
    h.attachIdentity.mockImplementation(() => {
      throw new Error('attach exploded')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await import('./workshop-session-state')

    const s = mod.useWorkshopSession()
    await vi.waitFor(() => expect(h.remint).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalledOnce())

    // The restore's re-mint settles only now, after begin threw and abandoned.
    finishRestore({ status: 'error', code: 'TOKEN_EXCHANGE_FAILED' })
    await new Promise((resolve) => setTimeout(resolve))

    expect(
      s.session.value,
      'a restore captured before begin threw must not publish after teardown'
    ).toBeUndefined()
    expect(s.signedIn.value).toBe(false)
    errorSpy.mockRestore()
  })
})
