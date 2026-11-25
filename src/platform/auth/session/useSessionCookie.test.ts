import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import type { WebSessionErrorCode } from '@comfyorg/account-core/webSession'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { useSessionCookie } from '@/platform/auth/session/useSessionCookie'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => distribution)
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('firebase/auth'))

describe('useSessionCookie', () => {
  beforeEach(() => {
    distribution.isCloud = true
  })

  it.for(['ensureSessionCookie', 'createSessionOrThrow'] as const)(
    '%s starts the web session and resolves once it is ready',
    async (name) => {
      const webSession = useCloudWebSessionStore()
      vi.mocked(webSession.start).mockReturnValue(true)
      let markReady = () => {}
      vi.mocked(webSession.whenReady).mockReturnValue(
        new Promise<void>((resolve) => {
          markReady = resolve
        })
      )
      let settled = false

      const sessionCookie = useSessionCookie()

      const call = sessionCookie[name]().then(() => {
        settled = true
      })
      await vi.runAllTimersAsync()

      expect(webSession.start).toHaveBeenCalledOnce()
      expect(settled).toBe(false)

      markReady()
      await call

      expect(settled).toBe(true)
    }
  )

  it('createSession starts the web session without waiting for it', async () => {
    const webSession = useCloudWebSessionStore()
    vi.mocked(webSession.start).mockReturnValue(true)
    vi.mocked(webSession.whenReady).mockReturnValue(new Promise<void>(() => {}))
    vi.mocked(webSession.whenSessionCreated).mockReturnValue(
      new Promise<WebSessionErrorCode | undefined>(() => {})
    )

    await useSessionCookie().createSession()

    expect(webSession.start).toHaveBeenCalledOnce()
  })

  it.for([
    { name: 'SSO_REQUIRED', refusal: 'SSO_REQUIRED', requiresSso: true },
    {
      name: 'another refusal',
      refusal: 'SESSION_REQUEST_REFUSED',
      requiresSso: false
    },
    { name: 'no refusal', refusal: undefined, requiresSso: false }
  ] satisfies {
    name: string
    refusal: WebSessionErrorCode | undefined
    requiresSso: boolean
  }[])(
    'sessionRequiresSso starts the web session and answers $requiresSso when its creation ends with $name',
    async ({ refusal, requiresSso }) => {
      const webSession = useCloudWebSessionStore()
      vi.mocked(webSession.start).mockReturnValue(true)
      vi.mocked(webSession.whenSessionCreated).mockResolvedValue(refusal)

      expect(await useSessionCookie().sessionRequiresSso()).toBe(requiresSso)
      expect(webSession.start).toHaveBeenCalledOnce()
    }
  )

  it.for([
    { name: 'ensureSessionCookie', expected: undefined },
    { name: 'createSession', expected: undefined },
    { name: 'createSessionOrThrow', expected: undefined },
    { name: 'sessionRequiresSso', expected: false }
  ] as const)(
    '$name leaves the web session alone off Cloud',
    async ({ name, expected }) => {
      distribution.isCloud = false

      await expect(useSessionCookie()[name]()).resolves.toBe(expected)
      expect(useCloudWebSessionStore().start).not.toHaveBeenCalled()
    }
  )

  it.for([
    { name: 'ensureSessionCookie', expected: undefined },
    { name: 'createSession', expected: undefined },
    { name: 'sessionRequiresSso', expected: false }
  ] as const)(
    '$name leaves the web session alone for an API-key login',
    async ({ name, expected }) => {
      useCurrentUser().isApiKeyLogin = computed(() => true)

      await expect(useSessionCookie()[name]()).resolves.toBe(expected)
      expect(useCloudWebSessionStore().start).not.toHaveBeenCalled()
    }
  )

  it('createSessionOrThrow still starts the web session for an API-key login', async () => {
    useCurrentUser().isApiKeyLogin = computed(() => true)
    const webSession = useCloudWebSessionStore()
    vi.mocked(webSession.start).mockReturnValue(true)
    vi.mocked(webSession.whenReady).mockResolvedValue()

    await useSessionCookie().createSessionOrThrow()

    expect(webSession.start).toHaveBeenCalledOnce()
  })
})
