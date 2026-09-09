import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

/**
 * The website's equivalents of the app's `signInDialogAuthErrors.spec.ts`
 * and `signInDialogPasswordRules.spec.ts`: Firebase error codes beyond
 * `auth-live.spec.ts`'s generic invalid-credential case, the live
 * password-requirements checklist, and the China region gate, all through
 * `AuthEmailForm.vue` / `AuthSignInPanel.vue`.
 */

const WORKSHOP_EMAIL = 'workshop-e2e@test.comfy.org'

function jsonRoute(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

async function forceWorkshopAuthFlag(page: Page) {
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

async function mockFirebaseSignUpFailure(
  page: Page,
  code: number,
  message: string
) {
  await page.route(
    '**/identitytoolkit.googleapis.com/**',
    async (route: Route) => {
      const url = route.request().url()
      if (!url.includes('accounts:signUp')) return route.fallback()
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

async function openEmailForm(page: Page) {
  await page.getByRole('button', { name: 'Use email instead' }).click()
}

test.describe('Live sign-in error codes', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/cdn-cgi/trace', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'loc=US\n'
      })
    )
    await forceWorkshopAuthFlag(page)
  })

  test('shows the same neutral copy for a nonexistent account as a wrong password', async ({
    page
  }) => {
    await mockFirebaseSignInFailure(page, 400, 'EMAIL_NOT_FOUND')
    await page.goto('/login/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill('nobody@test.comfy.org')
    await page.getByLabel('Password', { exact: true }).fill('whatever')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(
      page.getByText('Invalid login credentials'),
      'the same copy as a wrong password keeps sign-in from revealing whether an email has an account'
    ).toBeVisible()
  })

  test('reports a disabled account', async ({ page }) => {
    await mockFirebaseSignInFailure(page, 400, 'USER_DISABLED')
    await page.goto('/login/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill('correct-horse-battery-staple')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(
      page.getByText('This account has been disabled. Please contact support.')
    ).toBeVisible()
  })

  test('reports rate limiting after repeated failed attempts', async ({
    page
  }) => {
    await mockFirebaseSignInFailure(page, 400, 'TOO_MANY_ATTEMPTS_TRY_LATER')
    await page.goto('/login/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(
      page.getByText(
        'Too many login attempts. Please wait a moment and try again.'
      )
    ).toBeVisible()
  })

  test('reports a dropped connection without claiming invalid credentials', async ({
    page
  }) => {
    await page.route(
      '**/identitytoolkit.googleapis.com/**',
      async (route: Route) => {
        const url = route.request().url()
        if (!url.includes('accounts:signInWithPassword')) {
          return route.fallback()
        }
        await route.abort('failed')
      }
    )
    await page.goto('/login/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill('correct-horse-battery-staple')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(
      page.getByText(
        'Network error. Please check your connection and try again.'
      )
    ).toBeVisible()
  })
})

test.describe('Live sign-up error codes and password checklist', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/cdn-cgi/trace', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'loc=US\n'
      })
    )
    await forceWorkshopAuthFlag(page)
  })

  test('reports a duplicate email on sign-up instead of creating a second account', async ({
    page
  }) => {
    await mockFirebaseSignUpFailure(page, 400, 'EMAIL_EXISTS')
    await page.goto('/signup/')
    await openEmailForm(page)

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill('Sup3r-secret!1')
    await page.getByLabel('Confirm Password').fill('Sup3r-secret!1')
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()

    await expect(
      page.getByText(
        'An account with this email already exists. Try signing in instead.'
      )
    ).toBeVisible()
    await expect(page).toHaveURL(/\/signup\//)
  })

  test('marks unmet password rules as the password is typed', async ({
    page
  }) => {
    await page.goto('/signup/')
    await openEmailForm(page)

    const uppercaseRule = page.getByText(
      'Must contain at least one uppercase letter'
    )
    const specialRule = page.getByText(
      'Must contain at least one special character'
    )

    await page.getByLabel('Password', { exact: true }).fill('alllowercase1')
    await expect(uppercaseRule).toHaveClass(/text-red-500/)
    await expect(specialRule).toHaveClass(/text-red-500/)

    await page.getByLabel('Password', { exact: true }).fill('Sup3r-secret!1')
    await expect(uppercaseRule).not.toHaveClass(/text-red-500/)
    await expect(specialRule).not.toHaveClass(/text-red-500/)
  })

  test('replaces the sign-up form with the region notice inside China', async ({
    page
  }) => {
    await page.route('**/cdn-cgi/trace', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'loc=CN\n'
      })
    )
    await page.goto('/signup/')
    await openEmailForm(page)

    await expect(
      page.getByText(
        'In accordance with local regulatory requirements, our services are temporarily unavailable to users located in China.'
      )
    ).toBeVisible()
    await expect(page.getByLabel('Email')).toBeHidden()
  })
})

test.describe('Live forgot-password transport failure', () => {
  test.beforeEach(async ({ page }) => {
    await forceWorkshopAuthFlag(page)
  })

  test('stays on the form and lets the visitor retry, unlike an unregistered email', async ({
    page
  }) => {
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
                message: 'TOO_MANY_ATTEMPTS_TRY_LATER',
                errors: [
                  { message: 'TOO_MANY_ATTEMPTS_TRY_LATER', reason: 'invalid' }
                ]
              }
            },
            400
          )
        )
      }
    )
    await page.goto('/forgot-password/')

    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(
      page.getByText(
        'Too many login attempts. Please wait a moment and try again.'
      )
    ).toBeVisible()
    await expect(
      page.getByText('Password reset email sent'),
      'a rejected send is a real failure, not the neutral unregistered-email success'
    ).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Send reset link' }),
      'a failed send must stay retryable, not lock the form the way a confirmed send does'
    ).toBeEnabled()
  })
})
