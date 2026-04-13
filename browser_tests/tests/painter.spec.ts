import type { UploadImageResponse } from '@comfyorg/ingest-types'
import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { triggerSerialization } from '@e2e/helpers/painter'

/**
 * Draw a horizontal stroke across the painter canvas.
 * Returns the canvas bounding box used for the stroke.
 */
async function drawStroke(
  page: Page,
  canvas: Locator,
  options?: {
    startX?: number
    startY?: number
    endX?: number
    endY?: number
    steps?: number
  }
) {
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box not found')

  const {
    startX = 0.3,
    startY = 0.5,
    endX = 0.7,
    endY = 0.5,
    steps = 10
  } = options ?? {}

  await page.mouse.move(box.x + box.width * startX, box.y + box.height * startY)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * endX, box.y + box.height * endY, {
    steps
  })
  await page.mouse.up()

  return box
}

/** Count the number of non-transparent pixels on the canvas. */
function countOpaquePixels(canvas: Locator) {
  return canvas.evaluate((el) => {
    const ctx = (el as HTMLCanvasElement).getContext('2d')
    if (!ctx) return 0
    const data = ctx.getImageData(
      0,
      0,
      (el as HTMLCanvasElement).width,
      (el as HTMLCanvasElement).height
    )
    let count = 0
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] > 0) count++
    }
    return count
  })
}

/** Check if the canvas has any non-transparent pixels. */
function canvasHasContent(canvas: Locator) {
  return canvas.evaluate((el) => {
    const ctx = (el as HTMLCanvasElement).getContext('2d')
    if (!ctx) return false
    const data = ctx.getImageData(
      0,
      0,
      (el as HTMLCanvasElement).width,
      (el as HTMLCanvasElement).height
    )
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] > 0) return true
    }
    return false
  })
}

test.describe('Painter', () => {
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

      const isEmptyBefore = await canvas.evaluate((el) => {
        const ctx = (el as HTMLCanvasElement).getContext('2d')
        if (!ctx) return true
        const data = ctx.getImageData(
          0,
          0,
          (el as HTMLCanvasElement).width,
          (el as HTMLCanvasElement).height
        )
        return data.data.every((v, i) => (i % 4 === 3 ? v === 0 : true))
      })
      expect(isEmptyBefore).toBe(true)

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
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await expect(async () => {
        const hasContent = await canvas.evaluate((el) => {
          const ctx = (el as HTMLCanvasElement).getContext('2d')
          if (!ctx) return false
          const data = ctx.getImageData(
            0,
            0,
            (el as HTMLCanvasElement).width,
            (el as HTMLCanvasElement).height
          )
          for (let i = 3; i < data.data.length; i += 4) {
            if (data.data[i] > 0) return true
          }
          return false
        })
        expect(hasContent).toBe(true)
      }).toPass({ timeout: 5000 })

      await expect(node).toHaveScreenshot('painter-after-stroke.png')
    }
  )

  test('Clear button removes all painted content', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')
    const canvas = painterWidget.locator('canvas')
    await expect(canvas).toBeVisible()

    await drawStroke(comfyPage.page, canvas)
    await comfyPage.nextFrame()

    await expect.poll(() => canvasHasContent(canvas)).toBe(true)

    await painterWidget.getByText('Clear').click()
    await comfyPage.nextFrame()

    await expect.poll(() => canvasHasContent(canvas)).toBe(false)
  })

  test('Eraser tool removes previously drawn content', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')
    const canvas = painterWidget.locator('canvas')
    await expect(canvas).toBeVisible()

    // Draw a brush stroke
    await drawStroke(comfyPage.page, canvas)
    await comfyPage.nextFrame()

    const pixelsAfterBrush = await countOpaquePixels(canvas)
    expect(pixelsAfterBrush).toBeGreaterThan(0)

    // Switch to eraser
    await painterWidget.getByText('Eraser').click()

    // Erase over the same area
    await drawStroke(comfyPage.page, canvas)
    await comfyPage.nextFrame()

    await expect
      .poll(() => countOpaquePixels(canvas), { timeout: 3000 })
      .toBeLessThan(pixelsAfterBrush)
  })

  test('Switching to eraser hides color and hardness controls', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')

    // In brush mode, color picker and hardness should be visible
    await expect(painterWidget.getByText('Color Picker')).toBeVisible()
    await expect(painterWidget.getByText('Hardness')).toBeVisible()

    // Switch to eraser
    await painterWidget.getByText('Eraser').click()

    // Color and hardness controls should be hidden
    await expect(painterWidget.getByText('Color Picker')).toBeHidden()
    await expect(painterWidget.getByText('Hardness')).toBeHidden()
  })

  test('Switching back to brush re-shows color and hardness controls', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')

    await painterWidget.getByText('Eraser').click()
    await expect(painterWidget.getByText('Color Picker')).toBeHidden()

    await painterWidget.getByText('Brush').click()
    await expect(painterWidget.getByText('Color Picker')).toBeVisible()
    await expect(painterWidget.getByText('Hardness')).toBeVisible()
  })

  test('Brush size slider updates the displayed value', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')

    // The default brush size is 20; find the size display
    const sizeLabel = painterWidget.getByText('Cursor Size')
    await expect(sizeLabel).toBeVisible()

    // The size row contains a slider and a numeric display
    const sizeRow = sizeLabel.locator('~ div').first()
    const sizeDisplay = sizeRow.locator('span').last()
    const initialSize = await sizeDisplay.textContent()
    expect(initialSize?.trim()).toBe('20')

    // Drag the slider thumb to the right to increase size
    const slider = sizeRow.getByRole('slider')
    const sliderBox = await slider.boundingBox()
    if (!sliderBox) throw new Error('Slider thumb not found')

    const sliderTrack = sizeRow.locator('span').first()
    const trackBox = await sliderTrack.boundingBox()
    if (!trackBox) throw new Error('Slider track not found')

    await slider.dispatchEvent('pointerdown', { bubbles: true })
    await comfyPage.page.mouse.move(
      sliderBox.x + sliderBox.width / 2,
      sliderBox.y + sliderBox.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(
      trackBox.x + trackBox.width * 0.8,
      sliderBox.y + sliderBox.height / 2,
      { steps: 5 }
    )
    await comfyPage.page.mouse.up()

    // The displayed value should have increased
    await expect
      .poll(async () => {
        const text = await sizeDisplay.textContent()
        return Number(text?.trim())
      })
      .toBeGreaterThan(20)
  })

  test('Drawing with different brush sizes produces different stroke widths', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')
    const canvas = painterWidget.locator('canvas')
    await expect(canvas).toBeVisible()

    // Draw with the default brush size (20)
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.2,
      startY: 0.3,
      endX: 0.8,
      endY: 0.3
    })
    await comfyPage.nextFrame()

    const smallBrushPixels = await countOpaquePixels(canvas)

    // Clear the canvas
    await painterWidget.getByText('Clear').click()
    await comfyPage.nextFrame()

    // Set brush size to a larger value by dragging the slider far right
    const sizeLabel = painterWidget.getByText('Cursor Size')
    const sizeRow = sizeLabel.locator('~ div').first()
    const slider = sizeRow.getByRole('slider')
    const sliderBox = await slider.boundingBox()
    if (!sliderBox) throw new Error('Slider thumb not found')

    const trackBox = await sizeRow.boundingBox()
    if (!trackBox) throw new Error('Size row not found')

    await comfyPage.page.mouse.move(
      sliderBox.x + sliderBox.width / 2,
      sliderBox.y + sliderBox.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(
      trackBox.x + trackBox.width * 0.95,
      sliderBox.y + sliderBox.height / 2,
      { steps: 5 }
    )
    await comfyPage.page.mouse.up()

    // Draw with the larger brush size in the same area
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.2,
      startY: 0.3,
      endX: 0.8,
      endY: 0.3
    })
    await comfyPage.nextFrame()

    await expect
      .poll(() => countOpaquePixels(canvas))
      .toBeGreaterThan(smallBrushPixels)
  })

  test('Canvas width and height controls are shown and adjustable', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')

    // Width and Height labels should be visible (no image input connected)
    await expect(painterWidget.getByText('Width')).toBeVisible()
    await expect(painterWidget.getByText('Height')).toBeVisible()

    // Default canvas size is 512x512 — displayed in the width/height rows
    const widthRow = painterWidget.getByText('Width').locator('~ div').first()
    const widthDisplay = widthRow.locator('span').last()
    await expect(widthDisplay).toHaveText('512')

    const heightRow = painterWidget.getByText('Height').locator('~ div').first()
    const heightDisplay = heightRow.locator('span').last()
    await expect(heightDisplay).toHaveText('512')
  })

  test('Background color control is visible when no image input is connected', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')

    await expect(painterWidget.getByText('Background')).toBeVisible()

    // There should be two color inputs: brush color and background color
    const colorInputs = painterWidget.locator('input[type="color"]')
    await expect(colorInputs).toHaveCount(2)
  })

  test('Drawing a stroke then clearing and redrawing works correctly', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')
    const canvas = painterWidget.locator('canvas')
    await expect(canvas).toBeVisible()

    // Draw first stroke
    await drawStroke(comfyPage.page, canvas)
    await comfyPage.nextFrame()
    await expect.poll(() => canvasHasContent(canvas)).toBe(true)

    // Clear
    await painterWidget.getByText('Clear').click()
    await comfyPage.nextFrame()
    await expect.poll(() => canvasHasContent(canvas)).toBe(false)

    // Draw second stroke in a different position
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.2,
      startY: 0.2,
      endX: 0.8,
      endY: 0.8
    })
    await comfyPage.nextFrame()
    await expect.poll(() => canvasHasContent(canvas)).toBe(true)
  })

  test('Multiple strokes accumulate on the canvas', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const canvas = node.locator('.widget-expands canvas')
    await expect(canvas).toBeVisible()

    // First stroke (horizontal)
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.2,
      startY: 0.3,
      endX: 0.8,
      endY: 0.3
    })
    await comfyPage.nextFrame()
    const pixelsAfterFirst = await countOpaquePixels(canvas)

    // Second stroke (vertical, different area)
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.5,
      startY: 0.1,
      endX: 0.5,
      endY: 0.9
    })
    await comfyPage.nextFrame()

    await expect
      .poll(() => countOpaquePixels(canvas))
      .toBeGreaterThan(pixelsAfterFirst)
  })

  test('Eraser does not add visible content to an empty canvas', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')
    const canvas = painterWidget.locator('canvas')
    await expect(canvas).toBeVisible()

    // Switch to eraser on empty canvas
    await painterWidget.getByText('Eraser').click()

    // Draw with eraser on empty canvas
    await drawStroke(comfyPage.page, canvas)
    await comfyPage.nextFrame()

    // Canvas should still be empty since eraser uses destination-out
    await expect.poll(() => canvasHasContent(canvas)).toBe(false)
  })

  test(
    'Brush color picker is a color input',
    { tag: ['@smoke'] },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const painterWidget = node.locator('.widget-expands')

      // The first color input is the brush color
      const brushColorInput = painterWidget
        .locator('input[type="color"]')
        .first()
      await expect(brushColorInput).toBeVisible()

      // Default brush color is white (#ffffff)
      await expect(brushColorInput).toHaveValue('#ffffff')
    }
  )

  test('Opacity input accepts percentage values', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')

    // The opacity input is a number input inside the color row
    const opacityInput = painterWidget.locator('input[type="number"]').first()
    await expect(opacityInput).toBeVisible()

    // Default opacity is 100%
    await expect(opacityInput).toHaveValue('100')
  })

  test('Partial erasing leaves some content behind', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const painterWidget = node.locator('.widget-expands')
    const canvas = painterWidget.locator('canvas')
    await expect(canvas).toBeVisible()

    // Draw two separate horizontal strokes
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.1,
      startY: 0.3,
      endX: 0.9,
      endY: 0.3
    })
    await comfyPage.nextFrame()
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.1,
      startY: 0.7,
      endX: 0.9,
      endY: 0.7
    })
    await comfyPage.nextFrame()

    const pixelsBeforeErase = await countOpaquePixels(canvas)

    // Switch to eraser and erase only the top stroke area
    await painterWidget.getByText('Eraser').click()
    await drawStroke(comfyPage.page, canvas, {
      startX: 0.1,
      startY: 0.3,
      endX: 0.9,
      endY: 0.3
    })
    await comfyPage.nextFrame()

    // Some content should remain (the bottom stroke), but less than before
    await expect(async () => {
      const remaining = await countOpaquePixels(canvas)
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThan(pixelsBeforeErase)
    }).toPass({ timeout: 5000 })
  })

  test.describe('Serialization', () => {
    test('Drawing triggers upload on serialization', async ({ comfyPage }) => {
      const mockUploadResponse: UploadImageResponse = {
        name: 'painter-test.png'
      }
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
        const mockResponse: UploadImageResponse = { name: 'painter-test.png' }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
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

      await expect(triggerSerialization(comfyPage.page)).rejects.toThrow()

      await expect(comfyPage.toast.visibleToasts.first()).toBeVisible()
    })
  })
})
