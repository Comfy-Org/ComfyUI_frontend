import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

/** Answer PostHog's flag request with the Workshop auth flag on, nothing else leaves. */
async function forceWorkshopAuthFlag(page: Page) {
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
      page.getByRole('heading', { name: 'Sign in to Comfy' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Continue with Google' })
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Continue with GitHub' })
    ).toBeEnabled()
    await expect(
      page.getByRole('link', { name: 'Create an account' })
    ).toHaveAttribute('href', '/signup/')
  })

  test('/signup/ renders the sign-up options and links back to sign-in', async ({
    page
  }) => {
    await page.goto('/signup/')

    await expect(
      page.getByRole('heading', { name: 'Create your Comfy account' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Continue with Google' })
    ).toBeEnabled()
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login/'
    )
  })
})
