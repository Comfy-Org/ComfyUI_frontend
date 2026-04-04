import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { TestGraphAccess } from '../types/globals'

async function drawStroke(
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

async function hasCanvasContent(canvas: Locator): Promise<boolean> {
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

async function triggerSerialization(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const graph = window.graph as TestGraphAccess
    const node = graph._nodes_by_id['1']
    const widget = node.widgets?.find((w) => w.name === 'mask')
    await widget?.serializeValue?.(node, 0)
  })
}

test.describe('Painter', { tag: '@widget' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/painter_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'Renders canvas and controls',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      const painterWidget = node.locator('.widget-expands')
      await expect(painterWidget).toBeVisible()

      await expect(painterWidget.locator('canvas')).toBeVisible()
      await expect(painterWidget.getByText('Brush')).toBeVisible()
      await expect(painterWidget.getByText('Eraser')).toBeVisible()
      await expect(painterWidget.getByText('Clear')).toBeVisible()
      await expect(
        painterWidget.locator('input[type="color"]').first()
      ).toBeVisible()

      await expect(node).toHaveScreenshot('painter-default-state.png')
    }
  )

  test(
    'Drawing a stroke changes the canvas',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const canvas = node.locator('.widget-expands canvas')
      await expect(canvas).toBeVisible()

      expect(await hasCanvasContent(canvas), 'canvas should start empty').toBe(
        false
      )

      await drawStroke(comfyPage.page, canvas)

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas should have content after stroke'
        })
        .toBe(true)

      await expect(node).toHaveScreenshot('painter-after-stroke.png')
    }
  )

  test.describe('Drawing', () => {
    test('Eraser removes drawn content', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const painterWidget = node.locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')

      await drawStroke(comfyPage.page, canvas)

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas must have content before erasing'
        })
        .toBe(true)

      await painterWidget.getByText('Eraser').click()
      await drawStroke(comfyPage.page, canvas)

      const isCenterClear = await canvas.evaluate((el: HTMLCanvasElement) => {
        const ctx = el.getContext('2d')
        if (!ctx) return false
        const cx = Math.floor(el.width / 2)
        const cy = Math.floor(el.height / 2)
        const { data } = ctx.getImageData(cx - 5, cy - 5, 10, 10)
        return data.every((v, i) => i % 4 !== 3 || v === 0)
      })
      expect(isCenterClear, 'erased area should be transparent').toBe(true)
    })

    test('Stroke ends cleanly when pointer up fires outside canvas', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas bounding box not found')

      await comfyPage.page.mouse.move(
        box.x + box.width * 0.3,
        box.y + box.height * 0.5
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        box.x + box.width * 0.7,
        box.y + box.height * 0.5,
        { steps: 10 }
      )
      await comfyPage.page.mouse.move(box.x - 20, box.y + box.height * 0.5)
      await comfyPage.page.mouse.up()

      await comfyPage.nextFrame()

      await drawStroke(comfyPage.page, canvas, {
        startXPct: 0.3,
        endXPct: 0.7,
        yPct: 0.7
      })

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas should have content after new stroke'
        })
        .toBe(true)
    })
  })

  test.describe('Tool selection', () => {
    test('Switching to eraser hides brush-only controls', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')

      await expect(painterWidget.getByTestId('painter-color-row')).toBeVisible()
      await expect(
        painterWidget.getByTestId('painter-hardness-row')
      ).toBeVisible()

      await painterWidget.getByText('Eraser').click()

      await expect(
        painterWidget.getByTestId('painter-color-row')
      ).not.toBeVisible()
      await expect(
        painterWidget.getByTestId('painter-hardness-row')
      ).not.toBeVisible()
    })

    test('Switching back to brush restores brush-only controls', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')

      await painterWidget.getByText('Eraser').click()
      await expect(
        painterWidget.getByTestId('painter-color-row'),
        'color row should be hidden in eraser mode'
      ).not.toBeVisible()

      await painterWidget.getByText('Brush').click()

      await expect(painterWidget.getByTestId('painter-color-row')).toBeVisible()
      await expect(
        painterWidget.getByTestId('painter-hardness-row')
      ).toBeVisible()
    })
  })

  test.describe('Brush settings', () => {
    test('Size slider updates the displayed value', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const sizeRow = painterWidget.getByTestId('painter-size-row')
      const sizeSlider = sizeRow.locator('[role="slider"]')
      const sizeDisplay = sizeRow.locator('span:not([data-slot])')

      await expect(sizeDisplay).toHaveText('20')

      await sizeSlider.focus()
      for (let i = 0; i < 10; i++) {
        await comfyPage.page.keyboard.press('ArrowRight')
      }

      await expect(sizeDisplay).toHaveText('30')
    })

    test('Opacity input clamps out-of-range values', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const opacityInput = painterWidget
        .getByTestId('painter-color-row')
        .locator('input[type="number"]')

      await opacityInput.fill('150')
      await opacityInput.press('Tab')
      await expect(opacityInput).toHaveValue('100')

      await opacityInput.fill('-10')
      await opacityInput.press('Tab')
      await expect(opacityInput).toHaveValue('0')
    })
  })

  test.describe('Canvas size controls', () => {
    test('Width and height sliders visible without connected input', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')

      await expect(painterWidget.getByTestId('painter-width-row')).toBeVisible()
      await expect(
        painterWidget.getByTestId('painter-height-row')
      ).toBeVisible()

      await expect(
        painterWidget.getByTestId('painter-dimension-text')
      ).not.toBeVisible()
    })

    test('Width slider resizes the canvas element', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      const widthSlider = painterWidget
        .getByTestId('painter-width-row')
        .locator('[role="slider"]')

      const initialWidth = await canvas.evaluate(
        (el: HTMLCanvasElement) => el.width
      )
      expect(initialWidth, 'canvas should start at default width').toBe(512)

      await widthSlider.focus()
      await comfyPage.page.keyboard.press('ArrowRight')

      await expect
        .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBe(576)
    })

    test('Resize preserves existing drawing', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      const widthSlider = painterWidget
        .getByTestId('painter-width-row')
        .locator('[role="slider"]')

      await drawStroke(comfyPage.page, canvas)
      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas must have content before resize'
        })
        .toBe(true)

      await widthSlider.focus()
      await comfyPage.page.keyboard.press('ArrowRight')

      await expect
        .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBe(576)

      await expect.poll(() => hasCanvasContent(canvas)).toBe(true)
    })
  })

  test.describe('Clear', () => {
    test('Clear removes all drawn content', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')

      await drawStroke(comfyPage.page, canvas)
      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas must have content before clear'
        })
        .toBe(true)

      await painterWidget.getByText('Clear').click()

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas should be clear after click'
        })
        .toBe(false)
    })

    test('Clear on empty canvas is harmless', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas should be initially empty'
        })
        .toBe(false)

      await painterWidget.getByText('Clear').click()

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas should remain clear'
        })
        .toBe(false)
    })
  })

  test.describe('Serialization', () => {
    test('Drawing triggers upload on serialization', async ({ comfyPage }) => {
      const mockUploadResponse: { name: string } = { name: 'painter-test.png' }
      let uploadCount = 0

      await comfyPage.page.route('**/upload/image', async (route) => {
        uploadCount++
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockUploadResponse)
        })
      })

      const canvas = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands canvas')

      await drawStroke(comfyPage.page, canvas)

      await triggerSerialization(comfyPage.page)

      expect(uploadCount, 'should upload exactly once').toBe(1)
    })

    test('Empty canvas does not upload on serialization', async ({
      comfyPage
    }) => {
      let uploadCount = 0

      await comfyPage.page.route('**/upload/image', async (route) => {
        uploadCount++
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ name: 'painter-test.png' })
        })
      })

      await triggerSerialization(comfyPage.page)

      expect(uploadCount, 'empty canvas should not upload').toBe(0)
    })

    test('Upload failure shows error toast', async ({ comfyPage }) => {
      await comfyPage.page.route('**/upload/image', async (route) => {
        await route.fulfill({ status: 500 })
      })

      const canvas = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands canvas')

      await drawStroke(comfyPage.page, canvas)

      await triggerSerialization(comfyPage.page).catch(() => undefined)

      await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()
    })
  })
})
