import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Nano Banana launch page placeholder', () => {
  test('renders the English launch page', async ({ page }) => {
    await page.goto('/nano-banana')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Nano Banana is now ripe' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'RUN NANO BANANA' })
    ).toBeVisible()
  })

  test('renders the localized launch page', async ({ page }) => {
    await page.goto('/zh-CN/nano-banana')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Nano Banana 熟了' })
    ).toBeVisible()
  })
})
