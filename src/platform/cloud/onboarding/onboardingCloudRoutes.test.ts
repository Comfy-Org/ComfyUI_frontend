import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cloudOnboardingRoutes,
  oauthConsentRedirect
} from '@/platform/cloud/onboarding/onboardingCloudRoutes'
import {
  captureOAuthRequestId,
  clearOAuthRequestId
} from '@/platform/cloud/oauth/oauthState'

const VALID_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000'

const createSessionOrThrow = vi.fn().mockResolvedValue(undefined)

vi.mock('@/platform/auth/session/useSessionCookie', () => ({
  useSessionCookie: () => ({ createSessionOrThrow })
}))

describe('cloudOnboardingRoutes', () => {
  it('consent route is not a child of the /cloud layout', () => {
    const cloudLayout = cloudOnboardingRoutes.find((r) => r.path === '/cloud')
    const childPaths = (cloudLayout?.children ?? []).map((c) => c.path)
    expect(childPaths).not.toContain('oauth/consent')
  })

  it('consent route lives under a standalone /oauth layout', () => {
    const oauthLayout = cloudOnboardingRoutes.find((r) => r.path === '/oauth')
    const consentRoute = oauthLayout?.children?.find(
      (c) => c.name === 'cloud-oauth-consent'
    )
    expect(consentRoute).toBeDefined()
    expect(consentRoute?.path).toBe('consent')
  })

  it('consent route carries no requiresAuth meta', () => {
    const oauthLayout = cloudOnboardingRoutes.find((r) => r.path === '/oauth')
    const consentRoute = oauthLayout?.children?.find(
      (c) => c.name === 'cloud-oauth-consent'
    )
    expect(consentRoute?.meta?.requiresAuth).toBeFalsy()
  })

  it('lazily resolves the /oauth layout and consent view components', async () => {
    const oauthLayout = cloudOnboardingRoutes.find((r) => r.path === '/oauth')
    const consentRoute = oauthLayout?.children?.find(
      (c) => c.name === 'cloud-oauth-consent'
    )
    const layoutLoader = oauthLayout?.component
    const consentLoader = consentRoute?.component
    expect(typeof layoutLoader).toBe('function')
    expect(typeof consentLoader).toBe('function')

    const layoutModule = await (layoutLoader as () => Promise<unknown>)()
    const consentModule = await (consentLoader as () => Promise<unknown>)()
    expect(layoutModule).toHaveProperty('default')
    expect(consentModule).toHaveProperty('default')
  })
})

describe('oauthConsentRedirect', () => {
  beforeEach(() => {
    clearOAuthRequestId()
    createSessionOrThrow.mockReset().mockResolvedValue(undefined)
  })

  it('routes to user-check and mints no session when no OAuth flow is pending', async () => {
    const target = await oauthConsentRedirect()

    expect(target).toEqual({ name: 'cloud-user-check' })
    expect(createSessionOrThrow).not.toHaveBeenCalled()
  })

  it('mints the Cloud session cookie before redirecting to consent when resuming OAuth', async () => {
    // Regression: an already-signed-in user (Firebase) carries no Cloud session
    // cookie, so the consent challenge fetch fails unless the cookie is minted
    // here, mirroring the post-login resume path.
    captureOAuthRequestId({ oauth_request_id: VALID_REQUEST_ID })

    const target = await oauthConsentRedirect()

    expect(createSessionOrThrow).toHaveBeenCalledOnce()
    expect(target).toEqual({
      name: 'cloud-oauth-consent',
      query: { oauth_request_id: VALID_REQUEST_ID }
    })
  })

  it('still lands on consent when session minting fails so the view can surface the error', async () => {
    captureOAuthRequestId({ oauth_request_id: VALID_REQUEST_ID })
    createSessionOrThrow.mockRejectedValue(new Error('Unauthorized'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const target = await oauthConsentRedirect()

      expect(target).toEqual({
        name: 'cloud-oauth-consent',
        query: { oauth_request_id: VALID_REQUEST_ID }
      })
      expect(warn).toHaveBeenCalledWith(
        'Failed to establish Cloud session cookie before OAuth consent:',
        expect.any(Error)
      )
    } finally {
      warn.mockRestore()
    }
  })
})
