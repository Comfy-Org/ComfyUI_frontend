import type { Page } from '@playwright/test'

import { nextFrame } from '@e2e/fixtures/utils/timing'

export async function pinCanvasTransform(
  page: Page,
  scale: number = 1,
  offset: [number, number] = [40, 40]
): Promise<void> {
  await page.evaluate(
    ({ scale, offset }) => {
      const canvas = window.app!.canvas
      canvas.ds.scale = scale
      canvas.ds.offset = offset
      canvas.setDirty(true, true)
    },
    { scale, offset }
  )
  await nextFrame(page)
}
