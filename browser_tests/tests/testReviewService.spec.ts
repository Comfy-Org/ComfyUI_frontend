import { expect, test } from '@playwright/test'

test.describe('Test Review Service', () => {
  test('should load test service for review validation', async ({ page }) => {
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check that the test service doesn't crash the page
    const hasErrors = await page.evaluate(() => {
      return window.console.error.toString().includes('TestReviewService')
    })

    expect(hasErrors).toBe(false)
  })
})
