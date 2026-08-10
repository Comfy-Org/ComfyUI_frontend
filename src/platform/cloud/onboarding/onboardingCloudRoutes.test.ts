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

const loggedIn = vi.hoisted(() => ({ value: false }))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ isLoggedIn: { value: loggedIn.value } })
}))

const oauthLayout = cloudOnboardingRoutes.find((r) => r.path === '/oauth')
const consentRoute = oauthLayout?.children?.find(
  (c) => c.name === 'cloud-oauth-consent'
)
const layoutLoader = oauthLayout?.component
const consentLoader = consentRoute?.component

/**
 * At module scope, not in the test body: these real loaders compile the views
 * and everything they import, and inside `it()` that is billed against the 5 s
 * test timeout (#14666). Collection time is untimed.
 */
const resolvedComponents = await Promise.all(
  [layoutLoader, consentLoader].map(async (loader) =>
    typeof loader === 'function'
      ? await (loader as () => Promise<unknown>)()
      : undefined
  )
)

describe('cloudOnboardingRoutes', () => {
  it('consent route is not a child of the /cloud layout', () => {
    const cloudLayout = cloudOnboardingRoutes.find((r) => r.path === '/cloud')
    const childPaths = (cloudLayout?.children ?? []).map((c) => c.path)
    expect(childPaths).not.toContain('oauth/consent')
  })

  it('consent route lives under a standalone /oauth layout', () => {
    expect(consentRoute).toBeDefined()
    expect(consentRoute?.path).toBe('consent')
  })

  it('forgot-password keeps the footer its terms and help links live in', () => {
    const cloudLayout = cloudOnboardingRoutes.find((r) => r.path === '/cloud')
    const forgotPassword = cloudLayout?.children?.find(
      (c) => c.name === 'cloud-forgot-password'
    )

    expect(forgotPassword).toBeDefined()
    expect(forgotPassword?.meta?.hideFooter).toBeFalsy()
    expect(forgotPassword?.meta?.showTermsNotice).toBeFalsy()
  })

  it('consent route carries no requiresAuth meta', () => {
    expect(consentRoute?.meta?.requiresAuth).toBeFalsy()
  })

  it('lazily resolves the /oauth layout and consent view components', () => {
    expect(typeof layoutLoader).toBe('function')
    expect(typeof consentLoader).toBe('function')

    const [layoutModule, consentModule] = resolvedComponents
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
    captureOAuthRequestId({ oauth_request_id: VALID_REQUEST_ID })

    const target = await oauthConsentRedirect()

    expect(
      createSessionOrThrow,
      'an already-signed-in Firebase user carries no Cloud session cookie, so the consent challenge fetch fails without this'
    ).toHaveBeenCalledOnce()
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

const cloudLayout = cloudOnboardingRoutes.find((r) => r.path === '/cloud')

const guardedRoutes = ['cloud-login', 'cloud-signup'].map((name) => {
  const route = cloudLayout?.children?.find((c) => c.name === name)
  if (typeof route?.beforeEnter !== 'function') {
    throw new Error(`${name} has no beforeEnter guard`)
  }
  return [name, route.beforeEnter, `/cloud/${route.path}`] as const
})

type GuardedRoute = (typeof guardedRoutes)[number]

async function runGuard(
  [name, guard, path]: GuardedRoute,
  query: Record<string, string>
) {
  const next = vi.fn()
  const to = { query, name, path }
  await (
    guard as unknown as (
      to: unknown,
      from: unknown,
      next: unknown
    ) => Promise<void>
  )(to, undefined, next)
  return next.mock.calls[0]?.[0]
}

describe.for(guardedRoutes)('%s beforeEnter', (route) => {
  beforeEach(() => {
    loggedIn.value = false
    clearOAuthRequestId()
    createSessionOrThrow.mockReset().mockResolvedValue(undefined)
  })

  it('lets a signed-out visitor through to the form', async () => {
    expect(await runGuard(route, {})).toBeUndefined()
  })

  it('redirects a signed-in visitor away from the auth page', async () => {
    loggedIn.value = true

    expect(await runGuard(route, {})).toEqual({ name: 'cloud-user-check' })
  })

  it('sends a signed-in visitor straight to consent mid-OAuth', async () => {
    loggedIn.value = true
    captureOAuthRequestId({ oauth_request_id: VALID_REQUEST_ID })

    expect(await runGuard(route, {})).toEqual({
      name: 'cloud-oauth-consent',
      query: { oauth_request_id: VALID_REQUEST_ID }
    })
  })

  it('honours ?switchAccount for a signed-in visitor', async () => {
    loggedIn.value = true

    expect(
      await runGuard(route, { switchAccount: '1' }),
      'without this escape hatch a signed-in user can never reach the form to switch accounts'
    ).toBeUndefined()
  })

  it('does not mint a session cookie when it lets the visitor through', async () => {
    loggedIn.value = true

    await runGuard(route, { switchAccount: '1' })

    expect(createSessionOrThrow).not.toHaveBeenCalled()
  })
})

describe('legacy /cloud/oauth/consent redirect', () => {
  const legacyRoute = cloudOnboardingRoutes.find(
    (r) => r.path === '/cloud/oauth/consent'
  )

  it('preserves the query the backend 302s with', () => {
    const redirect = legacyRoute?.redirect
    if (typeof redirect !== 'function') {
      throw new Error('legacy consent route has no redirect function')
    }

    const to = {
      name: undefined,
      path: '/cloud/oauth/consent',
      fullPath: `/cloud/oauth/consent?oauth_request_id=${VALID_REQUEST_ID}`,
      query: { oauth_request_id: VALID_REQUEST_ID },
      hash: '',
      params: {},
      matched: [],
      meta: {},
      redirectedFrom: undefined
    }

    const target = redirect(to, to)

    expect(
      target,
      'the backend still 302s to the old path, and dropping the query strands the consent view with no request to consent to'
    ).toEqual({
      path: '/oauth/consent',
      query: { oauth_request_id: VALID_REQUEST_ID }
    })
  })
})
