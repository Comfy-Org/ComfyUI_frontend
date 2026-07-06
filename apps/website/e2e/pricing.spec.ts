import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Pricing page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cloud/pricing')
  })

  const pricingSection = (page: Page) =>
    page.locator('section').filter({
      has: page.getByRole('heading', { name: /Choose a plan/i })
    })

  test('shows the three paid tiers and Enterprise', async ({ page }) => {
    const section = pricingSection(page)

    for (const label of ['STANDARD', 'CREATOR', 'PRO', 'ENTERPRISE']) {
      await expect(
        section.locator('span', { hasText: new RegExp(`^${label}$`) })
      ).toBeVisible()
    }
  })

  test('does not show the Free tier when SHOW_FREE_TIER is disabled', async ({
    page
  }) => {
    const section = pricingSection(page)

    await expect(section.locator('span', { hasText: /^FREE$/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^START FREE$/ })).toHaveCount(
      0
    )
    await expect(page.getByText(/Everything in Free, plus:/i)).toHaveCount(0)
  })

  test('stays in standard (non-education) mode', async ({ page }) => {
    await expect(page.getByText(/Yearly \(Up to 20% off\)/)).toBeVisible()
    await expect(page.getByText(/Yearly \(Up to 25% off\)/)).toHaveCount(0)
    await expect(page.getByText(/Educational savings/i)).toHaveCount(0)
    await expect(page.getByText(/Creative Campus/i)).toHaveCount(0)
    await expect(page.getByText(/Student Ambassador/i)).toHaveCount(0)
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
