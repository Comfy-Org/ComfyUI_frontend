import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { WebSession } from '@comfyorg/account-core/webSession'

import { cloudSignIn } from '@/platform/auth/session/cloudIdentityBoot'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { invalidateRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import {
  remoteConfig,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'
import { createAppRouter } from '@/router'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@/platform/auth/session/cloudIdentityBoot'), () => ({
  cloudSignIn: vi.fn()
}))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@comfyorg/telemetry/reportError'))

vi.mock(import('firebase/auth'))

const REROUTE_FLAG = 'ff:signed_out_reroute_enabled'

const sessionFor = (id: string) =>
  fromPartial<WebSession>({ user: { id, email: `${id}@example.com` } })

async function openSurveySignedIn() {
  const authStore = useAuthStore()
  authStore.isInitialized = true
  authStore.currentUser = fromPartial<User>({ uid: 'user-a' })
  const router = await createAppRouter()
  await router.push('/cloud/survey')
  expect(router.currentRoute.value.name).toBe('cloud-survey')
  vi.spyOn(router, 'replace')
  return router
}

describe('a requiresAuth route whose account leaves the tab', () => {
  beforeEach(() => {
    vi.mocked(cloudSignIn).mockImplementation(async () =>
      useAuthStore().isAuthenticated || useApiKeyAuthStore().isAuthenticated
        ? 'signed_in'
        : 'signed_out'
    )
  })

  afterEach(() => {
    localStorage.removeItem(REROUTE_FLAG)
    remoteConfig.value = {}
    remoteConfigState.value = 'unloaded'
  })

  it('stays on the page with the reroute flag off', async () => {
    const router = await openSurveySignedIn()

    useAuthStore().currentUser = null
    await nextTick()

    expect(router.replace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('cloud-survey')
  })

  it('lands on sign-in with the reroute flag on', async () => {
    localStorage.setItem(REROUTE_FLAG, 'true')
    const router = await openSurveySignedIn()

    useAuthStore().currentUser = null

    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('cloud-login')
    )
  })

  it('lands on sign-in when signing out clears the remote config that enabled the reroute', async () => {
    remoteConfig.value = { signed_out_reroute_enabled: true }
    const router = await openSurveySignedIn()

    remoteConfig.value = {}
    useAuthStore().currentUser = null

    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('cloud-login')
    )
  })

  it.for(['reading', 'retry_wait', 'restoring'] as const)(
    'waits out a %s web session and only leaves once it signs out',
    async (phase) => {
      localStorage.setItem(REROUTE_FLAG, 'true')
      const webSession = useCloudWebSessionStore()
      webSession.state = { phase: 'signed_in', session: sessionFor('user-a') }
      const router = await openSurveySignedIn()
      useAuthStore().currentUser = null
      await nextTick()

      webSession.state = { phase, failures: 1 }
      await nextTick()
      expect(router.replace).not.toHaveBeenCalled()

      webSession.state = { phase: 'signed_in', session: sessionFor('user-a') }
      await nextTick()
      expect(router.replace).not.toHaveBeenCalled()

      webSession.state = { phase: 'signed_out', outcome: 'signed_out' }
      await vi.waitFor(() =>
        expect(router.currentRoute.value.name).toBe('cloud-login')
      )
    }
  )

  it('lands on sign-in when Firebase signs out before the web session does', async () => {
    remoteConfig.value = { signed_out_reroute_enabled: true }
    remoteConfigState.value = 'authenticated'
    const webSession = useCloudWebSessionStore()
    webSession.state = { phase: 'signed_in', session: sessionFor('user-a') }
    const router = await openSurveySignedIn()

    invalidateRemoteConfig()
    useAuthStore().currentUser = null
    await nextTick()
    expect(router.replace).not.toHaveBeenCalled()

    webSession.state = { phase: 'signed_out', outcome: 'signed_out' }
    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('cloud-login')
    )
  })

  it('lands on sign-in when an API-key-only account leaves', async () => {
    localStorage.setItem(REROUTE_FLAG, 'true')
    const authStore = useAuthStore()
    authStore.isInitialized = true
    const apiKeyAuthStore = useApiKeyAuthStore()
    apiKeyAuthStore.currentUser = fromPartial({ id: 'api-key-user' })
    const router = await createAppRouter()
    await router.push('/cloud/survey')
    expect(router.currentRoute.value.name).toBe('cloud-survey')

    apiKeyAuthStore.currentUser = null

    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('cloud-login')
    )
  })

  it("stays on the page when a switched-in account's flag is off and its config fails", async () => {
    remoteConfig.value = { signed_out_reroute_enabled: true }
    remoteConfigState.value = 'authenticated'
    const router = await openSurveySignedIn()

    remoteConfig.value = {}
    remoteConfigState.value = 'error'
    useAuthStore().currentUser = fromPartial<User>({ uid: 'user-b' })
    await nextTick()
    useAuthStore().currentUser = null
    await nextTick()

    expect(router.replace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('cloud-survey')
  })

  it('lands on sign-in when the remote config fails to load before the account leaves', async () => {
    remoteConfig.value = { signed_out_reroute_enabled: true }
    remoteConfigState.value = 'authenticated'
    const router = await openSurveySignedIn()

    remoteConfig.value = {}
    remoteConfigState.value = 'error'
    await nextTick()
    useAuthStore().currentUser = null

    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('cloud-login')
    )
  })
})
