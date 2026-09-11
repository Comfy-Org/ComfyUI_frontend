import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { MODEL_PATH } from './fixtures/modelsAccount'

test('keeps the public site when PostHog is unavailable', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: 'Models', exact: true })
  ).toBeHidden()
  await expect(page.getByTestId('model-discovery')).toBeHidden()
  await expect(
    page.getByRole('link', { name: 'Sign in', exact: true })
  ).toBeHidden()
  await page
    .getByRole('link', { name: 'Explore Seedance 2.5' })
    .scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('link', { name: 'Explore Seedance 2.5' })
  ).toHaveAttribute('href', '/seedance-2.5')

  await page.goto('/models/')
  await expect(
    page.getByRole('link', { name: /Grok Imagine/i }).first()
  ).toBeVisible()
  await expect(page.getByTestId('workshop-search')).toBeHidden()
  await page.goto(MODEL_PATH)
  await expect(page.getByTestId('model-hero')).toBeHidden()
  await expect(page.getByTestId('model-detail')).toBeHidden()
})

test('keeps the public Models page when the flag is disabled', async ({
  context,
  page
}) => {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          json: {
            featureFlags: { 'workshop-enabled': false },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
  const response = page.waitForResponse((response) =>
    /t\.comfy\.org\/(flags|decide)\//.test(response.url())
  )
  await page.goto('/models/')
  await response
  await expect(page.getByTestId('workshop-search')).toBeHidden()
  await expect(
    page.getByRole('link', { name: /Grok Imagine/i }).first()
  ).toBeVisible()
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('renders the public Models page without exposing the catalogue', async ({
    page
  }) => {
    await page.goto('/models/')
    await expect(page.getByTestId('workshop-search')).toBeHidden()
    await expect(
      page.getByRole('link', { name: /Grok Imagine/i }).first()
    ).toBeVisible()
  })
})
