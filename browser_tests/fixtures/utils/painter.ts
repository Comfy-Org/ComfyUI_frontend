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
  await page.waitForFunction(() => {
    const graph = window.graph as TestGraphAccess | undefined
    const node = graph?._nodes_by_id?.['1']
    const widget = node?.widgets?.find((w) => w.name === 'mask')
    return typeof widget?.serializeValue === 'function'
  })

  await page.evaluate(async () => {
    const graph = window.graph as TestGraphAccess | undefined
    if (!graph) {
      throw new Error(
        'Global window.graph is absent. Ensure workflow fixture is loaded.'
      )
    }

    const node = graph._nodes_by_id?.['1']
    if (!node) {
      throw new Error(
        'Target node with ID "1" not found in graph._nodes_by_id.'
      )
    }

    const widgetIndex = node.widgets?.findIndex((w) => w.name === 'mask') ?? -1
    if (widgetIndex === -1) {
      throw new Error('Widget "mask" not found on target node 1.')
    }

    const widget = node.widgets?.[widgetIndex]
    if (!widget) {
      throw new Error(`Widget index ${widgetIndex} not found on target node 1.`)
    }

    if (typeof widget.serializeValue !== 'function') {
      throw new Error(
        'mask widget on node 1 does not have a serializeValue function.'
      )
    }

    await widget.serializeValue(node, widgetIndex)
  })
}
