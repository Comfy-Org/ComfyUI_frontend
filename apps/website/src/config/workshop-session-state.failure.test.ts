// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  attachIdentity: vi.fn<() => () => void>(),
  subscribers: new Set<(snapshot: unknown) => void>()
}))

vi.mock<unknown>(import('../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  return { useWorkshopAuthFlag: () => flag }
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
      listener({
        phase: 'signed-out',
        user: null,
        session: undefined,
        settled: false
      })
      return () => h.subscribers.delete(listener)
    },
    attachIdentity: h.attachIdentity,
    ensureFresh: vi.fn(),
    remint: vi.fn(),
    clearStoredCredential: vi.fn(),
    getSnapshot: () => ({
      phase: 'signed-out',
      user: null,
      session: undefined,
      settled: false
    }),
    getToken: vi.fn()
  },
  subscribeAuthRefreshTelemetry: () => () => undefined
}))

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
})
