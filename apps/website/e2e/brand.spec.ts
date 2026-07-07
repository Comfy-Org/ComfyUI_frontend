import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const BRAND_ASSETS_ZIP =
  'https://media.comfy.org/website/comfy-org-brand-assets.zip'
const BRAND_GUIDELINES_PDF =
  'https://media.comfy.org/website/Comfy_Brand_guideline_2026.pdf'

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

  test('offers a single logo bundle download and shows all four marks', async ({
    page
  }) => {
    const logos = page.locator('#logos')
    await expect(
      logos.getByRole('link', { name: 'Download logos' })
    ).toHaveAttribute('href', BRAND_ASSETS_ZIP)
    for (const name of [
      'Core Logo',
      'Logomark',
      'Icon',
      'Amplified Logomark'
    ]) {
      await expect(logos.getByText(name, { exact: true })).toBeVisible()
    }
  })

  test('the hero cta downloads the brand guidelines pdf', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: 'View brand guidelines' })
    ).toHaveAttribute('href', BRAND_GUIDELINES_PDF)
  })
})
