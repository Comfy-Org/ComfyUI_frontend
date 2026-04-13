import type { Locator, Page } from '@playwright/test'
import type { TestGraphAccess } from '@e2e/types/globals'

export async function drawStroke(
  page: Page,
  canvas: Locator,
  opts: { startXPct?: number; endXPct?: number; yPct?: number } = {}
): Promise<void> {
  const { startXPct = 0.3, endXPct = 0.7, yPct = 0.5 } = opts
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box not found')
  await page.mouse.move(
    box.x + box.width * startXPct,
    box.y + box.height * yPct
  )
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width * endXPct,
    box.y + box.height * yPct,
    { steps: 10 }
  )
  await page.mouse.up()
}

export async function hasCanvasContent(canvas: Locator): Promise<boolean> {
  return canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')
    if (!ctx) return false
    const { data } = ctx.getImageData(0, 0, el.width, el.height)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true
    }
    return false
  })
}

export async function triggerSerialization(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const graph = window.graph! as TestGraphAccess
    const node = graph._nodes_by_id['1']
    const widget = node.widgets?.find((w) => w.name === 'mask')
    if (!widget?.serializeValue) {
      throw new Error('mask widget with serializeValue not found on node 1')
    }
    await widget.serializeValue(node, 0)
  })
}
