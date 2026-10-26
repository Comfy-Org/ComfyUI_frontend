import type { Page } from '@playwright/test'

const CANVAS_TEXT_PROBE_KEY = '__comfyE2eCanvasTextProbe'

export async function startCanvasTextProbe(
  page: Page,
  expectedTexts: string[]
): Promise<void> {
  await page.evaluate(
    ({ expectedTexts, key }) => {
      const context = window.app!.canvas.bgcanvas.getContext('2d')
      if (!context) throw new Error('Canvas context unavailable')
      const expected = new Set(expectedTexts)
      const observed: string[] = []
      const original = context.fillText.bind(context)
      Reflect.set(window, key, observed)
      context.fillText = (text, x, y, maxWidth) => {
        if (expected.has(text) && !observed.includes(text)) observed.push(text)
        if (maxWidth === undefined) return original(text, x, y)
        return original(text, x, y, maxWidth)
      }
    },
    { expectedTexts, key: CANVAS_TEXT_PROBE_KEY }
  )
}

export function readCanvasTextProbe(page: Page): Promise<string[]> {
  return page.evaluate((key) => {
    const observed: unknown = Reflect.get(window, key)
    if (!Array.isArray(observed)) return []
    return observed.filter((text): text is string => typeof text === 'string')
  }, CANVAS_TEXT_PROBE_KEY)
}
