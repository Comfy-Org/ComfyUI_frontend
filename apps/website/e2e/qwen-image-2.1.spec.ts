import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Qwen Image 2.1 launch page @smoke', () => {
  test('renders the full launch page', async ({ page }) => {
    await page.goto('/qwen-image-2.1')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1 is here' })
    ).toBeVisible()
    await expect(page.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/qwen-image-2.1/hero.mp4'
    )
  })

  test('never paints the unmasked photo while the spinning logo loads', async ({
    page
  }) => {
    await page.goto('/qwen-image-2.1')

    const logoMask = page.getByTestId('model-launch-hero-logo-mask')
    await expect(logoMask.locator('img')).toHaveCount(0)
    await expect(
      logoMask.getByTestId('model-launch-hero-logo-fallback')
    ).toBeVisible()
  })

  test('keeps the flat logo for visitors who prefer reduced motion', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/qwen-image-2.1')

    const logoMask = page.getByTestId('model-launch-hero-logo-mask')
    await expect(
      logoMask.getByTestId('model-launch-hero-logo-fallback')
    ).toBeVisible()
    await expect(logoMask.locator('canvas')).toHaveCount(0)
    await expect(logoMask.locator('img')).toHaveCount(0)
  })
})

test.describe('Qwen Image 2.1 launch page — zh-CN', () => {
  test('renders the localized launch page', async ({ page }) => {
    await page.goto('/zh-CN/qwen-image-2.1')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1 已上线' })
    ).toBeVisible()
  })
})
