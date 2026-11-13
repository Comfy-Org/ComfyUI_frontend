import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n } from '@/i18n'
import OAuthConsentView from '@/platform/cloud/oauth/OAuthConsentView.vue'
import {
  getWorkspaceId,
  StorageKeys
} from '@/platform/workflow/persistence/base/storageKeys'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

const { recreateSession } = vi.hoisted(() => ({
  recreateSession:
    vi.fn<() => Promise<'created' | 'identity_changed' | 'failed'>>()
}))

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))
vi.mock(import('@/platform/auth/session/useSessionCookie'), () => ({
  useSessionCookie: () => ({
    createSession: vi.fn(),
    createSessionOrThrow: vi.fn(),
    recreateSession,
    sessionRequiresSso: vi.fn(),
    ensureSessionCookie: vi.fn(),
    deleteSession: vi.fn()
  })
}))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))

const oauthRequestId = '550e8400-e29b-41d4-a716-446655440000'
const draftIndexKey = StorageKeys.draftIndex('personal-workspace')
const draftPayloadKey = StorageKeys.draftPayload(
  'workflows/unsaved.json',
  'personal-workspace'
)

describe('OAuthConsentView signing in again without a Cloud session cookie', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    localStorage.setItem(draftIndexKey, '{"order":["unsaved"]}')
    localStorage.setItem(draftPayloadKey, '{"nodes":[]}')
    recreateSession.mockResolvedValue('failed')
    vi.mocked(useAuthStore().logout).mockResolvedValue(undefined)
  })

  async function signInAgainFromConsent() {
    const navigation = vi
      .spyOn(window.location, 'href', 'set')
      .mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValueOnce(
      Object.defineProperty(new Response(null), 'type', {
        value: 'opaqueredirect'
      })
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/oauth/consent', component: OAuthConsentView }]
    })
    await router.push(`/oauth/consent?oauth_request_id=${oauthRequestId}`)

    render(OAuthConsentView, { global: { plugins: [i18n, router] } })
    await userEvent.click(
      await screen.findByRole('button', {
        name: i18n.global.t('oauth.consent.signInAgain')
      })
    )

    await vi.waitFor(() =>
      expect(navigation).toHaveBeenCalledExactlyOnceWith(
        `/cloud/login?switchAccount=true&oauth_request_id=${oauthRequestId}`
      )
    )
  }

  it('keeps the persisted workflow drafts of a tab with no workflows loaded', async () => {
    await signInAgainFromConsent()

    expect(useAuthStore().logout).toHaveBeenCalledOnce()
    expect(localStorage.getItem(draftIndexKey)).toBe('{"order":["unsaved"]}')
    expect(localStorage.getItem(draftPayloadKey)).toBe('{"nodes":[]}')
  })

  it('clears the unsent agent prompt so the next account to sign in does not see it', async () => {
    const composerDraftKey = StorageKeys.agentComposerDraft(getWorkspaceId())
    localStorage.setItem(
      composerDraftKey,
      JSON.stringify({
        threadId: null,
        text: 'Use  as the style',
        workflowReferences: [
          { id: 'wf-portrait', name: 'portrait', textOffset: 4 }
        ]
      })
    )

    await signInAgainFromConsent()

    expect(localStorage.getItem(composerDraftKey)).toBeNull()
    expect(localStorage.getItem(draftIndexKey)).toBe('{"order":["unsaved"]}')
    expect(localStorage.getItem(draftPayloadKey)).toBe('{"nodes":[]}')
  })
})
