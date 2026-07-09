import { expect } from '@playwright/test'

import { BRAND_ASSETS_ZIP, BRAND_GUIDELINES_PDF } from '../src/data/brandAssets'
import { test } from './fixtures/blockExternalMedia'

test.describe('Brand portal @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brand')
  })

  test('renders each brand guideline section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create with ComfyUI' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'One mark, many dimensions.' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Every color earns its place.' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Precise, never cute.' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Trademark guidelines.' })
    ).toBeVisible()
  })

  test('shows all four marks', async ({ page }) => {
    const logos = page.locator('#logos')
    for (const name of [
      'Core Logo',
      'Logomark',
      'Icon',
      'Amplified Logomark'
    ]) {
      await expect(logos.getByText(name, { exact: true })).toBeVisible()
    }
  })

  test('the hero ctas open the gated guidelines and the logo bundle', async ({
    page
  }) => {
    await expect(
      page.getByRole('link', { name: 'View brand guidelines' })
    ).toHaveAttribute('href', BRAND_GUIDELINES_PDF)
    await expect(
      page.getByRole('link', { name: 'Download logos' })
    ).toHaveAttribute('href', BRAND_ASSETS_ZIP)
  })
})
