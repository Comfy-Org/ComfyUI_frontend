// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  attachIdentity: vi.fn(() => () => undefined)
}))

vi.mock<unknown>(import('../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
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
    subscribe: () => () => undefined,
    attachIdentity: h.attachIdentity,
    ensureFresh: vi.fn(),
    remint: vi.fn(),
    clearStoredCredential: vi.fn(),
    getSnapshot: () => ({
      phase: 'signed-out',
      user: null,
      session: undefined
    }),
    getToken: vi.fn()
  },
  subscribeAuthRefreshTelemetry: () => () => undefined
}))

beforeEach(() => {
  vi.resetModules()
})

describe('useWorkshopSession scope ownership', () => {
  it('does NOT strand a still-mounted island when the first caller unmounts', async () => {
    const mod = await import('./workshop-session-state')

    const firstCallerScope = effectScope()
    firstCallerScope.run(() => mod.useWorkshopSession())
    await vi.waitFor(() => expect(h.attachIdentity).toHaveBeenCalledOnce())

    firstCallerScope.stop()
    h.flag!.value = false
    await Promise.resolve()
    h.flag!.value = true

    await vi.waitFor(() =>
      expect(
        h.attachIdentity,
        'the shared flag watcher must survive its first caller unmounting, or every other island silently freezes'
      ).toHaveBeenCalledTimes(2)
    )
  })
})
