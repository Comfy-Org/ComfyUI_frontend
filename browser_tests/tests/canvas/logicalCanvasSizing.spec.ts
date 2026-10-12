import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  expectDevicePixelBackingStore,
  readCanvasBox
} from '@e2e/fixtures/utils/canvasMeasurements'

const DPR = 2

test.use({ deviceScaleFactor: DPR })

test.describe(
  'Canvas logical sizing at 200 percent display scaling',
  { tag: '@canvas' },
  () => {
    test('leaves the shipped canvas to its stylesheet when a legacy resize() runs', async ({
      comfyPage
    }) => {
      const inlineSize = await comfyPage.page.evaluate(() => {
        const { style } =
          document.querySelector<HTMLCanvasElement>('#graph-canvas')!
        window.app!.canvas.resize()
        return [style.width, style.height]
      })
      await comfyPage.nextFrame()

      expect(inlineSize).toEqual(['', ''])
      const box = await readCanvasBox(comfyPage.page)
      expect(box.layoutWidth).toBeCloseTo(box.containerWidth, 0)
      expect(box.layoutHeight).toBeCloseTo(box.containerHeight, 0)
      expectDevicePixelBackingStore(box, DPR)
    })

    test('keeps its logical size when a legacy resize() runs on a canvas with no CSS dimensions', async ({
      comfyPage
    }) => {
      const expected = await comfyPage.page.evaluate(() => {
        const canvas =
          document.querySelector<HTMLCanvasElement>('#graph-canvas')!
        const container = canvas.parentElement!
        const { width, height } = container.getBoundingClientRect()
        container.style.width = `${width}px`
        container.style.height = `${height}px`
        container.style.overflow = 'hidden'
        canvas.removeAttribute('class')
        canvas.width = container.offsetWidth
        canvas.height = container.offsetHeight

        window.app!.canvas.resize()

        return [container.offsetWidth, container.offsetHeight]
      })
      await comfyPage.nextFrame()

      await expect
        .poll(async () => {
          const box = await readCanvasBox(comfyPage.page)
          return [Math.round(box.layoutWidth), Math.round(box.layoutHeight)]
        })
        .toEqual(expected)

      expectDevicePixelBackingStore(await readCanvasBox(comfyPage.page), DPR)
    })
  }
)
