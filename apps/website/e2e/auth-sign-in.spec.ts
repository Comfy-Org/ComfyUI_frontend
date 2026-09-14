import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

async function waitForHydration(page: Page, pathname: string) {
  await page.waitForFunction(
    (expectedPathname) =>
      window.location.pathname === expectedPathname &&
      !document.querySelector('astro-island[ssr]'),
    pathname
  )
}

/**
 * Answer PostHog's flag request with the Workshop auth flag on and the geo
 * edge with a non-China country; nothing else leaves the page.
 */
async function forceWorkshopAuthFlag(page: Page) {
  await page.route('**/cdn-cgi/trace', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=US\n' })
  )
  await page.route('**/t.comfy.org/**', (route) => {
    if (!/\/(flags|decide)\//.test(route.request().url())) {
      return route.abort('blockedbyclient')
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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
    })
  })
}

test.describe('Sign-in page with the auth flag on', () => {
  test.beforeEach(async ({ page }) => {
    await forceWorkshopAuthFlag(page)
  })

  test('/login/ renders the sign-in options like the cloud app', async ({
    page
  }) => {
    await page.goto('/login/')

    await expect(
      page.getByRole('heading', { name: 'Log in to your account' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /with Google/ })
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: /with Github/ })
    ).toBeEnabled()
    await expect(
      page.getByRole('link', { name: 'Sign up here' })
    ).toHaveAttribute('href', '/signup/')
  })

  test('/signup/ renders the sign-up options and links back to sign-in', async ({
    page
  }) => {
    await page.goto('/signup/')

    await expect(
      page.getByRole('heading', { name: 'Create an account' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /with Google/ })
    ).toBeEnabled()
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login/'
    )
  })

  test('carries the return destination through the sign-up and forgot-password detours', async ({
    page
  }) => {
    await page.goto('/login/?returnTo=%2Fworkshop%2F')
    await waitForHydration(page, '/login/')

    await page.getByRole('link', { name: 'Sign up here' }).click()
    await expect(page).toHaveURL(/\/signup\/\?returnTo=%2Fworkshop%2F$/)

    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login\/\?returnTo=%2Fworkshop%2F$/)

    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(
      /\/forgot-password\/\?returnTo=%2Fworkshop%2F$/
    )
    await waitForHydration(page, '/forgot-password/')
    const backToLogin = page.getByRole('link', { name: 'Back to login' })
    await expect(backToLogin).toHaveAttribute(
      'href',
      '/login/?returnTo=%2Fworkshop%2F'
    )
    await backToLogin.click()
    await expect(page).toHaveURL(/\/login\/\?returnTo=%2Fworkshop%2F$/)
  })
})
