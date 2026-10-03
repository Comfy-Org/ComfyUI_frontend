import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({ deviceScaleFactor: 2 })

interface CanvasBox {
  readonly layoutWidth: number
  readonly layoutHeight: number
  readonly backingWidth: number
  readonly backingHeight: number
  readonly containerWidth: number
  readonly containerHeight: number
}

/** Reads what a user sees: the canvas's box on the page next to its bitmap. */
async function readCanvasBox(comfyPage: ComfyPage): Promise<CanvasBox> {
  return comfyPage.page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#graph-canvas')!
    const container = canvas.parentElement!
    const rect = canvas.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    return {
      layoutWidth: Math.round(rect.width),
      layoutHeight: Math.round(rect.height),
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      containerWidth: Math.round(containerRect.width),
      containerHeight: Math.round(containerRect.height)
    }
  })
}

test.describe(
  'Canvas logical sizing at 200 percent display scaling',
  { tag: '@canvas' },
  () => {
    test('fills its container at the logical size with a device-pixel backing store', async ({
      comfyPage
    }) => {
      expect(await comfyPage.page.evaluate(() => window.devicePixelRatio)).toBe(
        2
      )

      const box = await readCanvasBox(comfyPage)

      expect(box.layoutWidth).toBe(box.containerWidth)
      expect(box.layoutHeight).toBe(box.containerHeight)
      expect(box.backingWidth).toBe(box.layoutWidth * 2)
      expect(box.backingHeight).toBe(box.layoutHeight * 2)
    })

    test('keeps its logical size when a legacy resize() runs on a canvas with no CSS dimensions', async ({
      comfyPage
    }) => {
      // `LGraphCanvas.resize()` is public API that extensions still call, and it
      // sizes the canvas from its parent element. Put the canvas in the state an
      // extension-owned one is in — laid out from its own attributes, with no CSS
      // dimensions — inside a container whose size cannot follow it, then take
      // that legacy path.
      const expected = await comfyPage.page.evaluate(() => {
        const canvas =
          document.querySelector<HTMLCanvasElement>('#graph-canvas')!
        const container = canvas.parentElement!
        const { width, height } = container.getBoundingClientRect()
        container.style.width = `${width}px`
        container.style.height = `${height}px`
        container.style.overflow = 'hidden'
        canvas.className = 'touch-none'
        canvas.width = container.offsetWidth
        canvas.height = container.offsetHeight

        window.app!.canvas.resize()

        return [container.offsetWidth, container.offsetHeight]
      })
      await comfyPage.nextFrame()

      // The DPR-scaled backing store must not become the layout size: doubling
      // the box overflows the container and misplaces every pointer hit.
      await expect
        .poll(async () => {
          const box = await readCanvasBox(comfyPage)
          return [box.layoutWidth, box.layoutHeight]
        })
        .toEqual(expected)

      const after = await readCanvasBox(comfyPage)
      expect(after.backingWidth).toBe(after.layoutWidth * 2)
      expect(after.backingHeight).toBe(after.layoutHeight * 2)
    })
  }
)
