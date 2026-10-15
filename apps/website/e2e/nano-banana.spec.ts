import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Nano Banana launch page', () => {
  test('renders the English launch page', async ({ page }) => {
    await page.goto('/nano-banana')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Nano Banana 2.1 is here' })
    ).toBeVisible()
  })

  test('renders the localized launch page', async ({ page }) => {
    await page.goto('/zh-CN/nano-banana')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Nano Banana 2.1 来了' })
    ).toBeVisible()
  })
})
