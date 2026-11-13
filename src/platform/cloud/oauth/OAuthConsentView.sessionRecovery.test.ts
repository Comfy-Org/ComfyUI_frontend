import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n } from '@/i18n'
import OAuthConsentView from '@/platform/cloud/oauth/OAuthConsentView.vue'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))

const oauthRequestId = '550e8400-e29b-41d4-a716-446655440000'
const backendPaths = ['/oauth/authorize', '/api/auth/session']

describe('OAuthConsentView when ingest redirects the consent request while the session cookie is valid', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    useAuthStore().currentUser = fromPartial({ uid: 'user-a' })
    vi.mocked(useAuthStore().getIdToken).mockResolvedValue('firebase-id-token')
    vi.mocked(useAuthStore().logout).mockResolvedValue(undefined)
    vi.spyOn(window.location, 'href', 'set').mockImplementation(() => {})
  })

  it('re-creates the cookie, retries the consent request once, and shows the session error without signing out', async () => {
    const calls: string[] = []
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const { pathname } = new URL(String(input), location.href)
      if (backendPaths.includes(pathname)) {
        calls.push(`${init?.method ?? 'GET'} ${pathname}`)
      }
      if (pathname === '/api/auth/session') {
        return new Response(null, { status: 204 })
      }
      return Object.defineProperty(new Response(null), 'type', {
        value: 'opaqueredirect'
      })
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/oauth/consent', component: OAuthConsentView }]
    })
    await router.push(`/oauth/consent?oauth_request_id=${oauthRequestId}`)

    render(OAuthConsentView, { global: { plugins: [i18n, router] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      i18n.global.t('oauth.consent.sessionError')
    )
    expect(calls).toEqual([
      'GET /oauth/authorize',
      'POST /api/auth/session',
      'GET /oauth/authorize'
    ])
    expect(useAuthStore().logout).not.toHaveBeenCalled()
  })
})
