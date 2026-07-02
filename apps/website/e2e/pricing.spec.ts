import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Pricing page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cloud/pricing')
  })

  test('shows the three paid tiers and Enterprise', async ({ page }) => {
    const pricingGrid = page
      .locator('section', {
        has: page.getByRole('heading', { name: /Pricing/i })
      })
      .locator('.lg\\:grid')

    for (const label of ['STANDARD', 'CREATOR', 'PRO']) {
      await expect(
        pricingGrid.locator('span', { hasText: new RegExp(`^${label}$`) })
      ).toBeVisible()
    }

    await expect(
      page.getByRole('heading', { name: /Looking for Enterprise Solutions/i })
    ).toBeVisible()
  })

  test('does not show the Free tier when SHOW_FREE_TIER is disabled', async ({
    page
  }) => {
    const pricingGrid = page
      .locator('section', {
        has: page.getByRole('heading', { name: /Pricing/i })
      })
      .locator('.lg\\:grid')

    await expect(
      pricingGrid.locator('span', { hasText: /^FREE$/ })
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^START FREE$/ })).toHaveCount(
      0
    )
    await expect(page.getByText(/Everything in Free, plus:/i)).toHaveCount(0)
  })
})

test.describe('Cloud pricing teaser @smoke', () => {
  test('does not show the "Start free" tagline when SHOW_FREE_TIER is disabled', async ({
    page
  }) => {
    await page.goto('/cloud')
    await expect(
      page.getByText(/Start free\.\s*Upgrade when you're ready\./i)
    ).toHaveCount(0)
  })
})
