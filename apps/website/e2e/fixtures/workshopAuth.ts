import type { Page, Route } from '@playwright/test'

/**
 * Shared Workshop auth mocks for the live-auth website specs: the PostHog
 * flag forcing plus the Firebase Identity Toolkit REST responses. Kept in one
 * place so a Firebase payload-shape change is a single edit, not one per spec.
 */

export const WORKSHOP_UID = 'e2e-workshop-user'
export const WORKSHOP_EMAIL = 'workshop-e2e@test.comfy.org'

export function jsonRoute(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

/** Forces the `workshop-auth` flag on and answers the region probe as US. */
export async function forceWorkshopAuthFlag(page: Page) {
  await page.route('**/cdn-cgi/trace', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=US\n' })
  )
  await page.route('**/t.comfy.org/**', (route) => {
    if (!/\/(flags|decide)\//.test(route.request().url())) {
      return route.abort('blockedbyclient')
    }
    return route.fulfill(
      jsonRoute({
        featureFlags: { 'workshop-auth': true },
        featureFlagPayloads: {},
        flags: {
          'workshop-auth': {
            key: 'workshop-auth',
            enabled: true,
            variant: null,
            reason: { code: 'condition_match', condition_index: 0 },
            metadata: { id: 1, version: 1, payload: null }
          }
        }
      })
    )
  })
}

/** The workspace-token mint every successful Firebase sign-in triggers next. */
export async function mockWorkspaceMint(page: Page) {
  await page.route('**/api/auth/token', (route) =>
    route.fulfill(
      jsonRoute({
        token: 'mock-workspace-jwt',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
        role: 'owner',
        permissions: []
      })
    )
  )
}

/** The customer-provisioning POST every sign-in and sign-up fires afterwards. */
export async function mockProvisioning(page: Page, status = 201) {
  await page.route('**/customers', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill(jsonRoute({ id: 'e2e-customer-id' }, status))
  })
}

export async function mockFirebaseSignIn(page: Page) {
  await page.route(
    '**/identitytoolkit.googleapis.com/**',
    async (route: Route) => {
      const url = route.request().url()
      if (url.includes('accounts:signInWithPassword')) {
        return route.fulfill(
          jsonRoute({
            kind: 'identitytoolkit#VerifyPasswordResponse',
            localId: WORKSHOP_UID,
            email: WORKSHOP_EMAIL,
            displayName: '',
            idToken: 'mock-firebase-id-token',
            registered: true,
            refreshToken: 'mock-refresh-token',
            expiresIn: '3600'
          })
        )
      }
      if (url.includes('accounts:lookup')) {
        return route.fulfill(
          jsonRoute({
            kind: 'identitytoolkit#GetAccountInfoResponse',
            users: [
              {
                localId: WORKSHOP_UID,
                email: WORKSHOP_EMAIL,
                emailVerified: true,
                validSince: '0',
                lastLoginAt: String(Date.now()),
                createdAt: String(Date.now())
              }
            ]
          })
        )
      }
      return route.fallback()
    }
  )
  await page.route('**/securetoken.googleapis.com/**', (route) =>
    route.fulfill(
      jsonRoute({
        access_token: 'mock-firebase-id-token',
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: 'mock-refresh-token',
        id_token: 'mock-firebase-id-token',
        user_id: WORKSHOP_UID,
        project_id: 'dreamboothy-dev'
      })
    )
  )
}

export async function mockFirebaseSignInFailure(
  page: Page,
  code: number,
  message: string
) {
  await page.route(
    '**/identitytoolkit.googleapis.com/**',
    async (route: Route) => {
      const url = route.request().url()
      if (!url.includes('accounts:signInWithPassword')) return route.fallback()
      return route.fulfill(
        jsonRoute(
          {
            error: { code, message, errors: [{ message, reason: 'invalid' }] }
          },
          code
        )
      )
    }
  )
}

export async function mockFirebaseSignUp(page: Page) {
  const newUid = 'e2e-workshop-user-new'
  await page.route(
    '**/identitytoolkit.googleapis.com/**',
    async (route: Route) => {
      const url = route.request().url()
      if (url.includes('accounts:signUp')) {
        return route.fulfill(
          jsonRoute({
            kind: 'identitytoolkit#SignupNewUserResponse',
            localId: newUid,
            email: 'new-workshop-user@test.comfy.org',
            idToken: 'mock-firebase-id-token-new',
            refreshToken: 'mock-refresh-token-new',
            expiresIn: '3600'
          })
        )
      }
      if (url.includes('accounts:lookup')) {
        return route.fulfill(
          jsonRoute({
            kind: 'identitytoolkit#GetAccountInfoResponse',
            users: [
              {
                localId: newUid,
                email: 'new-workshop-user@test.comfy.org',
                emailVerified: false,
                validSince: '0',
                lastLoginAt: String(Date.now()),
                createdAt: String(Date.now())
              }
            ]
          })
        )
      }
      return route.fallback()
    }
  )
  await page.route('**/securetoken.googleapis.com/**', (route) =>
    route.fulfill(
      jsonRoute({
        access_token: 'mock-firebase-id-token-new',
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: 'mock-refresh-token-new',
        id_token: 'mock-firebase-id-token-new',
        user_id: newUid,
        project_id: 'dreamboothy-dev'
      })
    )
  )
}

export async function mockPasswordReset(page: Page) {
  await page.route(
    '**/identitytoolkit.googleapis.com/**',
    async (route: Route) => {
      const url = route.request().url()
      if (!url.includes('accounts:sendOobCode')) return route.fallback()
      const body: unknown = route.request().postDataJSON()
      const email =
        typeof body === 'object' &&
        body !== null &&
        'requestType' in body &&
        body.requestType === 'PASSWORD_RESET' &&
        'email' in body &&
        typeof body.email === 'string'
          ? body.email
          : undefined
      if (email === undefined) {
        return route.fulfill(
          jsonRoute(
            {
              error: {
                message: 'expected a PASSWORD_RESET request with a string email'
              }
            },
            400
          )
        )
      }
      return route.fulfill(
        jsonRoute({
          kind: 'identitytoolkit#GetOobConfirmationCodeResponse',
          email
        })
      )
    }
  )
}
