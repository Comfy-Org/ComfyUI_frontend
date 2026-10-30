import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WebSession } from '@comfyorg/account-core/webSession'

import { cloudSignIn } from '@/platform/auth/session/cloudIdentityBoot'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { createAppRouter } from '@/router'
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

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

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
  return router
}

describe('a requiresAuth route whose account leaves the tab', () => {
  beforeEach(() => {
    vi.mocked(cloudSignIn).mockImplementation(async () =>
      useAuthStore().isAuthenticated ? 'signed_in' : 'signed_out'
    )
  })

  afterEach(() => {
    localStorage.removeItem(REROUTE_FLAG)
  })

  it('stays on the page with the reroute flag off', async () => {
    const router = await openSurveySignedIn()

    useAuthStore().currentUser = null
    await flushPromises()

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

  it('waits out a recovering web session and only leaves once it signs out', async () => {
    localStorage.setItem(REROUTE_FLAG, 'true')
    const webSession = useCloudWebSessionStore()
    webSession.state = { phase: 'signed_in', session: sessionFor('user-a') }
    const router = await openSurveySignedIn()
    useAuthStore().currentUser = null
    await flushPromises()

    webSession.state = { phase: 'restoring', failures: 1 }
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('cloud-survey')

    webSession.state = { phase: 'signed_in', session: sessionFor('user-a') }
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('cloud-survey')

    webSession.state = { phase: 'signed_out', outcome: 'signed_out' }
    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('cloud-login')
    )
  })
})
