import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Qwen Image 2.1 announcement page @smoke', () => {
  test('announces the model as coming soon', async ({ page }) => {
    await page.goto('/qwen-image-2.1')

    await expect(page.getByText('Coming soon')).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'GET NOTIFIED' })).toBeVisible()
    await expect(page.locator('video')).toHaveCount(0)
  })
})

test.describe('Qwen Image 2.1 announcement page — zh-CN', () => {
  test('renders the localized announcement page', async ({ page }) => {
    await page.goto('/zh-CN/qwen-image-2.1')

    await expect(page.getByText('即将上线')).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: '获取通知' })).toBeVisible()
  })
})
