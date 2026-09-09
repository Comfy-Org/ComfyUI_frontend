// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  flag: undefined as { value: boolean } | undefined,
  userCallback: undefined as ((user: unknown) => void) | undefined,
  attachIdentity: vi.fn<
    (port: {
      onUserChanged: (callback: (user: unknown) => void) => () => void
    }) => () => void
  >(() => () => undefined)
}))

vi.mock<unknown>(import('../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  const flag = ref(true)
  h.flag = flag
  return { useWorkshopAuthFlag: () => flag }
})

vi.mock<unknown>(import('./workshop-firebase'), () => ({
  onWorkshopUserChanged: (callback: (user: unknown) => void) => {
    h.userCallback = callback
    return () => undefined
  },
  signOutWorkshop: vi.fn()
}))

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
  }
}))

beforeEach(() => {
  vi.resetModules()
})

describe('useWorkshopSession settled', () => {
  it('reports settled only once Firebase has delivered the restored user or none', async () => {
    const mod = await import('./workshop-session-state')
    const s = mod.useWorkshopSession()
    await vi.waitFor(() => expect(h.attachIdentity).toHaveBeenCalledOnce())
    h.attachIdentity.mock.calls[0]?.[0].onUserChanged(() => {})

    expect(
      s.settled.value,
      'before Firebase answers, nobody knows whether a user is signed in'
    ).toBe(false)

    h.userCallback?.(null)
    expect(s.settled.value).toBe(true)

    h.flag!.value = false
    await vi.waitFor(() => expect(s.settled.value).toBe(false))
  })
})
