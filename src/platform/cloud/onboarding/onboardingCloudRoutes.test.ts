import { mapValues } from 'es-toolkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'

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

// The `cloud-login` guard reads only `isLoggedIn.value`, so a plain box stands
// in for the ref and keeps the factory hoistable.
const { useCurrentUser, isLoggedIn } = vi.hoisted(() => {
  const isLoggedIn = { value: false }
  return { isLoggedIn, useCurrentUser: vi.fn(() => ({ isLoggedIn })) }
})

vi.mock('@/composables/auth/useCurrentUser', () => ({ useCurrentUser }))

beforeEach(() => {
  isLoggedIn.value = false
})

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

/**
 * Aborts in a global guard so the assertions see the fully resolved target
 * without loading the real onboarding views. Record-level redirects are applied
 * before guards run, so the guard observes the final destination and its
 * `redirectedFrom` says where the navigation started.
 */
async function attemptNavigation(target: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: cloudOnboardingRoutes
  })
  const attempts: RouteLocationNormalized[] = []
  router.beforeEach((to) => {
    attempts.push(to)
    return false
  })

  await router.push(target)
  return attempts[0]
}

/**
 * Swaps every view component — single or named — for a render-null stub while
 * leaving names, paths, meta, redirects and `beforeEnter` guards untouched.
 * `render` rather than `template` so the stubs need no runtime template
 * compiler.
 */
function stubViews(routes: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  const stub = { render: () => null }
  return routes.map((route) => ({
    ...route,
    ...('component' in route && route.component ? { component: stub } : {}),
    ...('components' in route && route.components
      ? { components: mapValues(route.components, () => stub) }
      : {}),
    ...('children' in route && route.children
      ? { children: stubViews(route.children) }
      : {})
  })) as RouteRecordRaw[]
}

/**
 * Lets navigation run to completion, unlike `attemptNavigation`, which aborts in
 * a global guard and so never reaches a per-route `beforeEnter`. Use this when
 * the guard itself is the thing under test.
 *
 * A guard that aborts or redirects unexpectedly makes `push` resolve with a
 * `NavigationFailure` rather than throw, so the failure is asserted here instead
 * of surfacing as a puzzling `currentRoute` mismatch in the caller.
 */
async function completeNavigation(target: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: stubViews(cloudOnboardingRoutes)
  })

  expect(await router.push(target)).toBeUndefined()

  return router.currentRoute.value
}

describe('cloudOnboardingRoutes', () => {
  it('redirects the legacy /login path to the cloud login route', async () => {
    const to = await attemptNavigation('/login')

    expect(to.name).toBe('cloud-login')
    expect(to.path).toBe('/cloud/login')
    expect(to.redirectedFrom?.path).toBe('/login')
  })

  it('preserves the query and hash through the legacy /login redirect', async () => {
    const to = await attemptNavigation(
      '/login?previousFullPath=%2Ffoo&campaign=one&campaign=two#section'
    )

    expect(to.name).toBe('cloud-login')
    expect(to.query.previousFullPath).toBe('/foo')
    expect(to.query.campaign).toEqual(['one', 'two'])
    expect(to.hash).toBe('#section')
  })

  /**
   * A repeated key arrives as an array, which a redirect that rebuilt the query
   * value by value would flatten to whichever copy it saw last. Marketing links
   * are the ones most likely to carry repeated UTM-style keys, and they are also
   * the traffic this redirect exists to catch. Case contributed by @dante01yoon
   * from the parallel fix in #15022.
   */
  it('preserves repeated query keys through the legacy /login redirect', async () => {
    const to = await attemptNavigation(
      '/login?source=legacy&campaign=one&campaign=two'
    )

    expect(to.name).toBe('cloud-login')
    expect(to.query).toEqual({
      source: 'legacy',
      campaign: ['one', 'two']
    })
  })

  it('resolves /cloud/login without redirecting', async () => {
    const to = await attemptNavigation('/cloud/login')

    expect(to.name).toBe('cloud-login')
    expect(to.fullPath).toBe('/cloud/login')
    expect(to.redirectedFrom).toBeUndefined()
  })

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

/**
 * The redirect tests above abort before any per-route guard runs, so they prove
 * the route table resolves `/login` but not that the destination still works
 * once it is entered. These drive the real `cloud-login` `beforeEnter` through
 * the redirect, which is the journey the reported bug actually took.
 */
describe('legacy /login through the cloud-login guard', () => {
  beforeEach(() => {
    clearOAuthRequestId()
    useCurrentUser.mockClear()
  })

  it('lands a signed-out visitor on the login view', async () => {
    const to = await completeNavigation('/login')

    expect(useCurrentUser).toHaveBeenCalled()
    expect(to.name).toBe('cloud-login')
    expect(to.path).toBe('/cloud/login')
  })

  it('forwards a signed-in visitor past the login view', async () => {
    isLoggedIn.value = true

    const to = await completeNavigation('/login')

    expect(useCurrentUser).toHaveBeenCalled()
    expect(to.name).toBe('cloud-user-check')
  })

  it('honours switchAccount through the redirect, leaving the guard inert', async () => {
    isLoggedIn.value = true

    const to = await completeNavigation('/login?switchAccount=true')

    expect(useCurrentUser).not.toHaveBeenCalled()
    expect(to.name).toBe('cloud-login')
    expect(to.query.switchAccount).toBe('true')
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
  if (Array.isArray(route?.beforeEnter)) {
    throw new Error(
      `${name} now has an array of beforeEnter guards; runGuard drives only one`
    )
  }
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
    isLoggedIn.value = false
    clearOAuthRequestId()
    createSessionOrThrow.mockReset().mockResolvedValue(undefined)
  })

  it('lets a signed-out visitor through to the form', async () => {
    expect(await runGuard(route, {})).toBeUndefined()
  })

  it('redirects a signed-in visitor away from the auth page', async () => {
    isLoggedIn.value = true

    expect(await runGuard(route, {})).toEqual({ name: 'cloud-user-check' })
  })

  it('sends a signed-in visitor straight to consent mid-OAuth', async () => {
    isLoggedIn.value = true
    captureOAuthRequestId({ oauth_request_id: VALID_REQUEST_ID })

    expect(await runGuard(route, {})).toEqual({
      name: 'cloud-oauth-consent',
      query: { oauth_request_id: VALID_REQUEST_ID }
    })
    expect(
      createSessionOrThrow,
      'routing to consent without the session cookie leaves the view making an unauthenticated request'
    ).toHaveBeenCalledOnce()
  })

  it('honours ?switchAccount for a signed-in visitor', async () => {
    isLoggedIn.value = true

    expect(
      await runGuard(route, { switchAccount: '1' }),
      'without this escape hatch a signed-in user can never reach the form to switch accounts'
    ).toBeUndefined()
  })

  it('does not mint a session cookie when it lets the visitor through', async () => {
    isLoggedIn.value = true

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
