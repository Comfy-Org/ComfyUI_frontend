import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const DPR = 2

test.use({ deviceScaleFactor: DPR })

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
      layoutWidth: rect.width,
      layoutHeight: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height
    }
  })
}

/**
 * The backing store holds one pixel per device pixel of the layout box. Stated
 * against the measured box rather than a fixed size, because a fractional
 * viewport rounds and the contract is the ratio, not the number.
 */
function expectDevicePixelBackingStore(box: CanvasBox): void {
  expect(box.backingWidth).toBe(Math.round(box.layoutWidth * DPR))
  expect(box.backingHeight).toBe(Math.round(box.layoutHeight * DPR))
}

test.describe(
  'Canvas logical sizing at 200 percent display scaling',
  { tag: '@canvas' },
  () => {
    test('fills its container at the logical size with a device-pixel backing store', async ({
      comfyPage
    }) => {
      expect(await comfyPage.page.evaluate(() => window.devicePixelRatio)).toBe(
        DPR
      )

      const box = await readCanvasBox(comfyPage)

      expect(box.layoutWidth).toBeCloseTo(box.containerWidth, 0)
      expect(box.layoutHeight).toBeCloseTo(box.containerHeight, 0)
      expectDevicePixelBackingStore(box)
    })

    test('leaves the shipped canvas to its stylesheet when a legacy resize() runs', async ({
      comfyPage
    }) => {
      // The shipped canvas is sized by its classes, so the same legacy path must
      // not pin it to pixels: pinning freezes it at one size and it stops
      // following its container. Nothing in the app calls resize() on boot, so
      // this drives it the way an extension would.
      const inlineSize = await comfyPage.page.evaluate(() => {
        const { style } =
          document.querySelector<HTMLCanvasElement>('#graph-canvas')!
        window.app!.canvas.resize()
        return [style.width, style.height]
      })
      await comfyPage.nextFrame()

      expect(inlineSize).toEqual(['', ''])
      const box = await readCanvasBox(comfyPage)
      expect(box.layoutWidth).toBeCloseTo(box.containerWidth, 0)
      expect(box.layoutHeight).toBeCloseTo(box.containerHeight, 0)
      expectDevicePixelBackingStore(box)
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
          return [Math.round(box.layoutWidth), Math.round(box.layoutHeight)]
        })
        .toEqual(expected)

      expectDevicePixelBackingStore(await readCanvasBox(comfyPage))
    })
  }
)
