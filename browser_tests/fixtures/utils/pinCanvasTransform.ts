import type { Page } from '@playwright/test'

import { nextFrame } from '@e2e/fixtures/utils/timing'

export async function pinCanvasTransform(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = window.app!.canvas
    canvas.ds.scale = 1
    canvas.ds.offset = [40, 40]
    canvas.setDirty(true, true)
  })
  await nextFrame(page)
}
