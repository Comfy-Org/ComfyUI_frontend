import type { Page } from '@playwright/test'

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function nextFrame(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>(requestAnimationFrame))
}
