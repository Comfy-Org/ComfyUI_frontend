import type { Page } from '@playwright/test'

export async function returnToTab(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}
