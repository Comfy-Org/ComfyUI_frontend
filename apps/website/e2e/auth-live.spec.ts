import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import {
  WORKSHOP_EMAIL,
  forceWorkshopAuthFlag,
  jsonRoute,
  mockFirebaseSignIn,
  mockFirebaseSignInFailure,
  mockFirebaseSignUp,
  mockPasswordReset,
  mockProvisioning,
  mockWorkspaceMint
} from './fixtures/workshopAuth'

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

    await expect(page.getByText('Invalid login credentials')).toBeVisible()
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
