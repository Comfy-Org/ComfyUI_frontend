import { expect, test } from '@playwright/test'

test.describe('Demo pages @smoke', () => {
  test('demo detail page renders hero and embed', async ({ page }) => {
    await page.goto('/demos/image-to-video')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Create a Video from an Image'
    )
    const iframe = page.locator('iframe[title*="Interactive demo"]')
    await expect(iframe).toBeAttached()
  })

  test('demo detail page has transcript section', async ({ page }) => {
    await page.goto('/demos/image-to-video')
    await expect(
      page.getByRole('button', { name: /demo transcript/i })
    ).toBeVisible()
  })

  test('demo detail page has next demo navigation', async ({ page }) => {
    await page.goto('/demos/image-to-video')
    await expect(page.getByText(/what's next/i)).toBeVisible()
  })

  test('demo library page renders', async ({ page }) => {
    await page.goto('/demos')
    await expect(page.getByText('Coming Soon')).toBeVisible()
  })

  test('non-existent demo returns 404', async ({ page }) => {
    const response = await page.goto('/demos/nonexistent')
    expect(response?.status()).toBe(404)
  })

  test('zh-CN demo page renders localized content', async ({ page }) => {
    await page.goto('/zh-CN/demos/image-to-video')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '从图片创建视频'
    )
    const nextDemoLink = page.locator('a[href*="/zh-CN/demos/"]').first()
    await expect(nextDemoLink).toBeAttached()
  })
})
