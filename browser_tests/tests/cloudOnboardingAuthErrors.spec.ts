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
type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

/**
 * The cloud onboarding pages' equivalents of `signInDialogAuthErrors.spec.ts`
 * and `signInDialogPasswordRules.spec.ts`: extra Firebase error codes, the
 * live password-requirements checklist, and the China region gate on
 * `/cloud/signup`, all through the standalone `CloudSignInForm.vue` /
 * `SignUpForm.vue` pages rather than the local dialog.
 */
const test = comfyPageFixture.extend<{ cloudAuth: CloudAuthHelper }>({
  page: async ({ page }, use) => {
    await mockCloudBoot(page, { features: {} })
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

test.describe('Cloud onboarding — auth error codes', { tag: '@cloud' }, () => {
  test('shows the same neutral copy for a nonexistent account as a wrong password', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'EMAIL_NOT_FOUND'
    })
    await openLoginEmailForm(page)

    await page.locator('#cloud-sign-in-email').fill('nobody@test.comfy.org')
    await page.locator('#cloud-sign-in-password').fill('whatever-password')
    await page.locator('#cloud-sign-in-password').blur()
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByText('Invalid login credentials'),
      'the same copy as a wrong password keeps sign-in from revealing whether an email has an account'
    ).toBeVisible()
  })

  test('reports a disabled account', async ({ page, cloudAuth }) => {
    await cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'USER_DISABLED'
    })
    await openLoginEmailForm(page)

    await page.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
    await page
      .locator('#cloud-sign-in-password')
      .fill('correct-horse-battery-staple')
    await page.locator('#cloud-sign-in-password').blur()
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByText('This account has been disabled. Please contact support.')
    ).toBeVisible()
  })

  test('reports rate limiting after repeated failed attempts', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLiveEmailSignInFailure({
      code: 400,
      message: 'TOO_MANY_ATTEMPTS_TRY_LATER'
    })
    await openLoginEmailForm(page)

    await page.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
    await page.locator('#cloud-sign-in-password').fill('wrong-password')
    await page.locator('#cloud-sign-in-password').blur()
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByText(
        'Too many login attempts. Please wait a moment and try again.'
      )
    ).toBeVisible()
  })

  test('reports a duplicate email on sign-up instead of creating a second account', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLiveEmailSignUpFailure({
      code: 400,
      message: 'EMAIL_EXISTS'
    })
    await openSignupEmailForm(page)

    await page.locator('#comfy-org-sign-up-email').fill(CLOUD_SELF_EMAIL)
    await page.locator('#comfy-org-sign-up-password').fill('Sup3r-secret-pass!')
    await page
      .locator('#comfy-org-sign-up-confirm-password')
      .fill('Sup3r-secret-pass!')
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()

    await expect(
      page.getByText(
        'An account with this email already exists. Try signing in instead.'
      )
    ).toBeVisible()
    await expect(page).toHaveURL(/\/cloud\/signup/)
  })

  test('reports a dropped connection without claiming invalid credentials', async ({
    page,
    cloudAuth
  }) => {
    await cloudAuth.mockLiveEmailSignInTransportFailure()
    await openLoginEmailForm(page)

    await page.locator('#cloud-sign-in-email').fill(CLOUD_SELF_EMAIL)
    await page
      .locator('#cloud-sign-in-password')
      .fill('correct-horse-battery-staple')
    await page.locator('#cloud-sign-in-password').blur()
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(
      page.getByText(
        'Network error. Please check your connection and try again.'
      )
    ).toBeVisible()
  })

  test('replaces the sign-up form with the region notice inside China', async ({
    page
  }) => {
    await page.route('https://cloud.comfy.org/cdn-cgi/trace', (route) =>
      route.fulfill({ contentType: 'text/plain', body: 'loc=CN\n' })
    )

    await page.goto(APP_URL)
    await page.getByRole('link', { name: 'Sign up here' }).click()
    await expect(
      page.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Use email instead' }).click()

    await expect(
      page.getByText(
        'In accordance with local regulatory requirements, our services are temporarily unavailable to users located in China.'
      )
    ).toBeVisible()
    await expect(page.locator('#comfy-org-sign-up-email')).toBeHidden()
  })
})
