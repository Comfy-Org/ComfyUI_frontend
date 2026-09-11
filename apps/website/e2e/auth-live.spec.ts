import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

/**
 * Live credential round trips for the website's auth pages, driven against
 * a mocked Firebase REST backend the way `auth-sign-in.spec.ts` mocks
 * PostHog: fill the real form, submit, and observe the app's own reaction
 * (redirect, toast, inline error), never asserting on the mocked network
 * call directly. Google/GitHub popup completion isn't driven here — no
 * automated harness can complete a real OAuth consent screen — but the
 * Firebase callback both providers funnel through afterwards (provisioning,
 * the workspace mint, the redirect) is exercised via the email path, which
 * shares that same code from `socialSignIn` onward.
 */

const WORKSHOP_UID = 'e2e-workshop-user'
const WORKSHOP_EMAIL = 'workshop-e2e@test.comfy.org'

function jsonRoute(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

async function forceWorkshopAuthFlag(page: Page) {
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
async function mockWorkspaceMint(page: Page) {
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
async function mockProvisioning(page: Page, status = 201) {
  await page.route('**/customers', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    return route.fulfill(jsonRoute({ id: 'e2e-customer-id' }, status))
  })
}

async function mockFirebaseSignIn(page: Page) {
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

async function mockFirebaseSignInFailure(
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

async function mockFirebaseSignUp(page: Page) {
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

async function mockPasswordReset(page: Page) {
  await page.route(
    '**/identitytoolkit.googleapis.com/**',
    async (route: Route) => {
      const url = route.request().url()
      if (!url.includes('accounts:sendOobCode')) return route.fallback()
      const body = route.request().postDataJSON() as { email?: string }
      return route.fulfill(
        jsonRoute({
          kind: 'identitytoolkit#GetOobConfirmationCodeResponse',
          email: body.email
        })
      )
    }
  )
}

async function openEmailForm(page: Page) {
  await page.getByRole('button', { name: 'Use email instead' }).click()
}

test.describe('Live email sign-in', () => {
  test.beforeEach(async ({ page }) => {
    await forceWorkshopAuthFlag(page)
    await mockWorkspaceMint(page)
    await mockProvisioning(page)
  })

  test('signs in and lands on the home page', async ({ page }) => {
    await mockFirebaseSignIn(page)
    await page.goto('/login/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill('correct-horse-battery-staple')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })

  test('carries returnTo to the post-sign-in destination', async ({ page }) => {
    await mockFirebaseSignIn(page)
    await page.goto('/login/?returnTo=%2Fworkshop%2F')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill('correct-horse-battery-staple')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL('/workshop/', { timeout: 10_000 })
  })

  test('shows an inline error and stays on the page for a wrong password', async ({
    page
  }) => {
    await mockFirebaseSignInFailure(page, 400, 'INVALID_LOGIN_CREDENTIALS')
    await page.goto('/login/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login\/(?:[?#].*)?$/)
  })

  test('keeps the user signed in with an inline message when provisioning fails', async ({
    page
  }) => {
    await mockFirebaseSignIn(page)
    await mockProvisioning(page, 500)
    await page.goto('/login/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill('correct-horse-battery-staple')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(
      page.getByText('account setup did not finish'),
      'a provisioning failure keeps the user on the page with the inline banner, mirroring the social path'
    ).toBeVisible()
    await expect(page).toHaveURL(/\/login\/(?:[?#].*)?$/)

    // The banner alone does not prove the session survived: a consumer that
    // signed the user out before throwing would render it identically. Reload
    // and confirm the restored session mints and carries the now-provisioned
    // user home — a signed-out user would stay on the login form.
    await page.unroute('**/customers')
    await mockProvisioning(page)
    await page.reload()
    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })
})

test.describe('Live email sign-up', () => {
  test.beforeEach(async ({ page }) => {
    await forceWorkshopAuthFlag(page)
    await mockWorkspaceMint(page)
    await mockProvisioning(page)
  })

  test('creates an account and lands on the home page', async ({ page }) => {
    await mockFirebaseSignUp(page)
    await page.goto('/signup/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill('new-workshop-user@test.comfy.org')
    await page.getByLabel('Password', { exact: true }).fill('Sup3r-secret!1')
    await page.getByLabel('Confirm Password').fill('Sup3r-secret!1')
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()

    await expect(page).toHaveURL('/', { timeout: 10_000 })
  })

  test('keeps the submit button disabled when the passwords do not match', async ({
    page
  }) => {
    await mockFirebaseSignUp(page)
    await page.goto('/signup/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill('mismatch@test.comfy.org')
    await page.getByLabel('Password', { exact: true }).fill('Sup3r-secret!1')
    await page.getByLabel('Confirm Password').fill('DifferentPassword!2')

    await expect(
      page.getByRole('button', { name: 'Sign up', exact: true }),
      'a mismatched confirmation must keep the submit button disabled, never allow the request to fire'
    ).toBeDisabled()
  })
})

test.describe('Live forgot-password', () => {
  test.beforeEach(async ({ page }) => {
    await forceWorkshopAuthFlag(page)
  })

  test('confirms the send and returns to login', async ({ page }) => {
    await mockPasswordReset(page)
    await page.goto('/forgot-password/')

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(page.getByText('Password reset email sent')).toBeVisible()
    await expect(page).toHaveURL('/login/', { timeout: 10_000 })
  })

  test('shows the same confirmation for an unregistered email, no enumeration', async ({
    page
  }) => {
    await mockFirebaseSignInFailure(page, 400, 'EMAIL_NOT_FOUND')
    await page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route: Route) => {
        const url = route.request().url()
        if (!url.includes('accounts:sendOobCode')) return route.fallback()
        return route.fulfill(
          jsonRoute(
            {
              error: {
                code: 400,
                message: 'EMAIL_NOT_FOUND',
                errors: [{ message: 'EMAIL_NOT_FOUND', reason: 'invalid' }]
              }
            },
            400
          )
        )
      }
    )
    await page.goto('/forgot-password/')

    await page.getByLabel('Email').fill('never-registered@test.comfy.org')
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(
      page.getByText('Password reset email sent'),
      'the cloud app shows success even on this failure to avoid confirming account existence'
    ).toBeVisible()
  })
})
