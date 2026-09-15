import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

for (const flagState of ['unavailable', 'models-disabled']) {
  test.describe(`First sign-in with PostHog ${flagState}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.route('https://apis.google.com/js/api.js*', (route) =>
        route.abort('blockedbyclient')
      )
      await context.route('**/t.comfy.org/**', (route) => {
        if (
          flagState === 'unavailable' ||
          !/\/(flags|decide)\//.test(route.request().url())
        )
          return route.abort('blockedbyclient')

        return route.fulfill({
          json: {
            featureFlags: { 'workshop-enabled': false },
            featureFlagPayloads: {}
          }
        })
      })
    })

    test('lets staff reach sign-in directly before Models is enabled @mobile', async ({
      page
    }) => {
      await page.goto('/login/?returnTo=%2Fmodels%2F')
      await expect(
        page.getByRole('button', { name: /with Google/ })
      ).toBeEnabled()
      await expect(
        page.getByRole('button', { name: /with Github/ })
      ).toBeEnabled()
      await page.getByRole('button', { name: 'Use email instead' }).click()
      await expect(page.getByLabel('Email')).toBeEditable()
      await expect(page.getByLabel('Password', { exact: true })).toBeEditable()
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await expect(page).toHaveURL(
        /\/forgot-password\/\?returnTo=%2Fmodels%2F$/
      )
      await expect(page.getByLabel('Email')).toBeEditable()
    })
  })
}
