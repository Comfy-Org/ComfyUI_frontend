import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { operations } from '@/types/comfyRegistryTypes'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  CLOUD_SELF_EMAIL,
  CloudAuthHelper
} from '@e2e/fixtures/helpers/CloudAuthHelper'
import { mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
// The guarded app root: the router bounces a signed-out visitor to /cloud/login,
// so reaching it proves auth — and excludes the transitional /cloud/user-check.
const APP_ROOT = new RegExp(
  `^${APP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?(\\?.*)?$`
)
type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

/**
 * Live sign-in/sign-up/forgot-password on the cloud onboarding pages
 * (`/cloud/login`, `/cloud/signup`, `/cloud/forgot-password`), driven for
 * real against a mocked Firebase REST backend. `cloud.spec.ts` only checks
 * pre-auth redirects; this file drives the actual credential round trip
 * through the standalone cloud views, which render a different sign-in form
 * (`CloudSignInForm.vue`) than the local dialog's `SignInForm.vue`.
 *
 * Drives a raw `page`, not `comfyPage`, same as `creditsTile.spec.ts`:
 * `comfyPage.setup()` expects the OSS devtools backend, which a
 * `DISTRIBUTION=cloud` build never calls.
 */
const test = comfyPageFixture.extend<{ cloudAuth: CloudAuthHelper }>({
  page: async ({ page }, use) => {
    await mockCloudBoot(page, { features: {} })
    // Pre-select the server user, so the post-auth root guard lands on the app
    // instead of redirecting to /user-select the way an unselected profile does.
    await page.addInitScript(() =>
      localStorage.setItem('Comfy.userId', 'test-user-e2e')
    )
    await page.route('**/customers', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        json: { id: 'test-customer-e2e' } satisfies CreateCustomerResponse
      })
    })
    await use(page)
  },
  cloudAuth: async ({ page }, use) => {
    await use(new CloudAuthHelper(page))
  }
})

/**
 * The raw ComfyUI backend has no SPA fallback route, so a direct
 * `page.goto('/cloud/...')` triggers a file download instead of serving
 * `index.html`. Load the root, which the auth guard always redirects to
 * `/cloud/login`, then reach the other onboarding pages via real link
 * clicks, same as a person would.
 */
async function openLoginEmailForm(page: Page) {
  await page.goto(APP_URL)
  await expect(
    page.getByRole('heading', { name: 'Log in to your account' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await expect(page.locator('#cloud-sign-in-email')).toBeVisible()
}

async function openSignupEmailForm(page: Page) {
  await openLoginEmailForm(page)
  await page.getByRole('link', { name: 'Sign up here' }).click()
  await expect(
    page.getByRole('heading', { name: 'Create an account' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await expect(page.locator('#comfy-org-sign-up-email')).toBeVisible()
}

async function openForgotPasswordForm(page: Page) {
  await openLoginEmailForm(page)
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(
    page.getByRole('heading', { name: 'Forgot Password' })
  ).toBeVisible()
}

test.describe('Cloud onboarding — live auth', { tag: '@cloud' }, () => {
  test('signs in with email and password', async ({ page, cloudAuth }) => {
    await cloudAuth.mockLiveEmailSignIn()
    await openLoginEmailForm(page)

    await page.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
    await page
      .locator('#cloud-sign-in-password')
      .fill('correct-horse-battery-staple')
    await page.locator('#cloud-sign-in-password').blur()
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(APP_ROOT, { timeout: 10_000 })
  })

  test('shows an inline error and stays on the login page on a wrong password', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'INVALID_LOGIN_CREDENTIALS'
    })
    await openLoginEmailForm(page)

    await page.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
    await page.locator('#cloud-sign-in-password').fill('wrong-password')
    await page.locator('#cloud-sign-in-password').blur()
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid login credentials')).toBeVisible()
    await expect(page).toHaveURL(/\/cloud\/login/)
  })

  test('creates an account with email, password, and confirmation', async ({
    page,
    cloudAuth
  }) => {
    const newEmail = 'new-cloud-user@test.comfy.org'
    await cloudAuth.mockLiveEmailSignUp(newEmail)
    await openSignupEmailForm(page)

    await page.locator('#comfy-org-sign-up-email').fill(newEmail)
    await page.locator('#comfy-org-sign-up-password').fill('Sup3r-secret-pass!')
    await page
      .locator('#comfy-org-sign-up-confirm-password')
      .fill('Sup3r-secret-pass!')
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()

    await expect(page).toHaveURL(APP_ROOT, { timeout: 10_000 })
  })

  test('keeps the submit button disabled while Turnstile is required and unsolved', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLiveEmailSignUp()
    await mockCloudBoot(page, { features: { signup_turnstile: 'enforce' } })
    await page.addInitScript(() => {
      // A stub Turnstile global that never calls back, so the widget stays
      // "loaded but unsolved" — the state a real challenge is in until a
      // person completes it.
      window.turnstile = {
        render: () => 'stub-widget-id',
        reset: () => {},
        remove: () => {}
      }
    })

    await openSignupEmailForm(page)

    await page
      .locator('#comfy-org-sign-up-email')
      .fill('turnstile-gated@test.comfy.org')
    await page.locator('#comfy-org-sign-up-password').fill('Sup3r-secret-pass!')
    await page
      .locator('#comfy-org-sign-up-confirm-password')
      .fill('Sup3r-secret-pass!')

    await expect(
      page.getByRole('button', { name: 'Sign up', exact: true }),
      'an unsolved Turnstile challenge must block signup submission'
    ).toBeDisabled()
  })

  test('sends a password reset email and shows the confirmation', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLivePasswordReset()
    await openForgotPasswordForm(page)

    await page.locator('#reset-email').fill(CLOUD_SELF_EMAIL)
    await page.getByRole('button', { name: 'Send reset link' }).click()

    await expect(page.getByText('Password reset sent')).toBeVisible()
  })

  test('reports a real transport failure on password reset without claiming success', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLivePasswordResetTransportFailure()
    await openForgotPasswordForm(page)

    // Let the aborted request fail first; the bug is a success shown before it returns.
    const resetFailed = page.waitForEvent('requestfailed', {
      predicate: (request) => request.url().includes('accounts:sendOobCode')
    })
    await page.locator('#reset-email').fill(CLOUD_SELF_EMAIL)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await resetFailed

    await expect(
      page.getByText('Failed to send password reset email'),
      'a real transport failure must surface the error, not silent success'
    ).toBeVisible()
    await expect(
      page.getByText('Password reset sent'),
      'a real transport failure must not show the success confirmation'
    ).toBeHidden()
  })

  test('navigates from login to signup and back via the inline links', async ({
    page
  }) => {
    await page.goto(APP_URL)
    await expect(
      page.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()

    await page.getByRole('link', { name: 'Sign up here' }).click()
    await expect(page).toHaveURL(/\/cloud\/signup/)

    await page.getByRole('link', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/cloud\/login/)
  })
})
