import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cloudSignIn } from '@/platform/auth/session/cloudIdentityBoot'
import {
  capturePreservedQuery,
  clearPreservedQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { createAppRouter } from '@/router'
import { api } from '@/scripts/api'
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

vi.mock(import('@/scripts/api'))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@comfyorg/telemetry/reportError'))

vi.mock(import('firebase/auth'))

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.DESKTOP_LOGIN
const VALID_CODE = `dlc_${'A'.repeat(43)}`

function stashCode() {
  capturePreservedQuery(NAMESPACE, { desktop_login_code: VALID_CODE }, [
    'desktop_login_code'
  ])
}

describe('desktop sign-in handoff reaching the workspace entry', () => {
  beforeEach(() => {
    vi.mocked(cloudSignIn).mockResolvedValue('signed_in')
    useAuthStore().isInitialized = true
  })

  afterEach(() => {
    clearPreservedQuery(NAMESPACE)
  })

  it('sends a signed-in Firebase tab with a stashed code to the approval page', async () => {
    useAuthStore().currentUser = fromPartial<User>({ uid: 'user-a' })
    stashCode()
    const router = await createAppRouter()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('cloud-desktop-login')
  })

  it('lets a signed-in Firebase tab without a stashed code reach the workspace', async () => {
    useAuthStore().currentUser = fromPartial<User>({ uid: 'user-a' })
    vi.mocked(api.getUserConfig).mockResolvedValue(fromPartial({}))
    const router = await createAppRouter()

    // The cloud guard runs first and must not redirect; stop before the heavy
    // workspace chunk loads and record where it let the tab go.
    let reached: string | undefined
    router.beforeEach((to) => {
      reached = String(to.name)
      return to.path === '/' ? false : undefined
    })

    await router.push('/')

    expect(reached).toBe('GraphView')
  })

  it('still bounces a session-only tab with a stashed code to sign-in to switch accounts', async () => {
    useAuthStore().currentUser = null
    stashCode()
    const router = await createAppRouter()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('cloud-login')
    expect(router.currentRoute.value.query.switchAccount).toBe('true')
  })
})
