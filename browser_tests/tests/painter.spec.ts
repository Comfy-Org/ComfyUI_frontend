import type { UploadImageResponse } from '@comfyorg/ingest-types'

import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  drawStroke,
  hasCanvasContent,
  triggerSerialization
} from '@e2e/helpers/painter'
import type { TestGraphAccess } from '@e2e/types/globals'

test.describe('Painter', { tag: ['@widget', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => window.app?.graph?.clear())
    await comfyPage.workflow.loadWorkflow('widgets/painter_widget')
  })

  test.describe('Widget rendering', () => {
    test('Node enforces minimum size', async ({ comfyPage }) => {
      const size = await comfyPage.page.evaluate(() => {
        const graph = window.graph as unknown as TestGraphAccess | undefined
        const node = graph?._nodes_by_id?.['1']
        return node?.size as [number, number] | undefined
      })
      expect(size).toBeDefined()
      expect(size![0]).toBeGreaterThanOrEqual(450)
      expect(size![1]).toBeGreaterThanOrEqual(550)
    })

    test('Width, height, and bg_color standard widgets are hidden', async ({
      comfyPage
    }) => {
      const hiddenFlags = await comfyPage.page.evaluate(() => {
        const graph = window.graph as unknown as TestGraphAccess | undefined
        const node = graph?._nodes_by_id?.['1']
        return (node?.widgets ?? [])
          .filter((w) => ['width', 'height', 'bg_color'].includes(w.name))
          .map((w) => w.options.hidden ?? false)
      })
      expect(hiddenFlags).toHaveLength(3)
      expect(hiddenFlags.every(Boolean)).toBe(true)
    })
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
      await expect(
        painterWidget.getByRole('button', { name: 'Brush' })
      ).toBeVisible()
      await expect(
        painterWidget.getByRole('button', { name: 'Eraser' })
      ).toBeVisible()
      await expect(
        painterWidget.getByTestId('painter-clear-button')
      ).toBeVisible()
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
    test(
      'Eraser removes drawn content',
      { tag: '@smoke' },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('1')
        const painterWidget = node.locator('.widget-expands')
        const canvas = painterWidget.locator('canvas')

        await drawStroke(comfyPage.page, canvas)

        await expect
          .poll(() => hasCanvasContent(canvas), {
            message: 'canvas must have content before erasing'
          })
          .toBe(true)

        await painterWidget.getByRole('button', { name: 'Eraser' }).click()
        await drawStroke(comfyPage.page, canvas)

        await expect
          .poll(
            () =>
              canvas.evaluate((el: HTMLCanvasElement) => {
                const ctx = el.getContext('2d')
                if (!ctx) return false
                const cx = Math.floor(el.width / 2)
                const cy = Math.floor(el.height / 2)
                const { data } = ctx.getImageData(cx - 5, cy - 5, 10, 10)
                return data.every((v, i) => i % 4 !== 3 || v === 0)
              }),
            { message: 'erased area should be transparent' }
          )
          .toBe(true)
      }
    )

    test('Custom brush cursor follows mouse and hides on leave', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      const cursor = painterWidget.getByTestId('painter-cursor')

      await expect(cursor).toBeHidden()

      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas bounding box not found')

      await comfyPage.page.mouse.move(
        box.x + box.width * 0.3,
        box.y + box.height * 0.5
      )
      await expect(cursor).toBeVisible()

      const transform1 = await cursor.evaluate(
        (el: HTMLElement) => el.style.transform
      )

      await comfyPage.page.mouse.move(
        box.x + box.width * 0.7,
        box.y + box.height * 0.5
      )
      const transform2 = await cursor.evaluate(
        (el: HTMLElement) => el.style.transform
      )
      expect(transform1).not.toBe(transform2)

      await comfyPage.page.mouse.move(0, 0)
      await expect(cursor).toBeHidden()
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

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message:
            'canvas should have content after stroke with pointer up outside'
        })
        .toBe(true)
    })
  })

  test.describe('Tool selection', () => {
    test('Tool switching toggles brush-only controls', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')

      await expect(painterWidget.getByTestId('painter-color-row')).toBeVisible()
      await expect(
        painterWidget.getByTestId('painter-hardness-row')
      ).toBeVisible()

      await painterWidget.getByRole('button', { name: 'Eraser' }).click()

      await expect(
        painterWidget.getByTestId('painter-color-row'),
        'color row should be hidden in eraser mode'
      ).toBeHidden()
      await expect(
        painterWidget.getByTestId('painter-hardness-row')
      ).toBeHidden()

      await painterWidget.getByRole('button', { name: 'Brush' }).click()

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
      const sizeSlider = sizeRow.getByRole('slider')
      const sizeDisplay = sizeRow.getByTestId('painter-size-value')

      await expect(sizeDisplay).toHaveText('20')

      await sizeSlider.focus()
      for (let i = 0; i < 10; i++) {
        await sizeSlider.press('ArrowRight')
      }

      await expect(sizeDisplay).toHaveText('30')
    })

    test('Hardness slider updates the displayed value', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const hardnessRow = painterWidget.getByTestId('painter-hardness-row')
      const hardnessSlider = hardnessRow.getByRole('slider')

      await expect(hardnessRow.locator('span').last()).toHaveText('100%')

      await hardnessSlider.focus()
      for (let i = 0; i < 10; i++) {
        await hardnessSlider.press('ArrowLeft')
      }

      await expect(hardnessRow.locator('span').last()).toHaveText('90%')
    })

    test('Color picker changes the color of drawn strokes', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      const colorInput = painterWidget
        .getByTestId('painter-color-row')
        .locator('input[type="color"]')

      await colorInput.evaluate((el: HTMLInputElement) => {
        el.value = '#ff0000'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })

      await drawStroke(comfyPage.page, canvas)

      await expect
        .poll(
          () =>
            canvas.evaluate((el: HTMLCanvasElement) => {
              const ctx = el.getContext('2d')
              if (!ctx) return false
              const cx = Math.floor(el.width / 2)
              const cy = Math.floor(el.height / 2)
              const { data } = ctx.getImageData(cx - 20, cy - 20, 40, 40)
              for (let i = 0; i < data.length; i += 4) {
                if (
                  data[i] > 200 &&
                  data[i + 1] < 50 &&
                  data[i + 2] < 50 &&
                  data[i + 3] > 0
                )
                  return true
              }
              return false
            }),
          { message: 'stroke should have red pixels' }
        )
        .toBe(true)
    })

    test('Opacity setting produces semi-transparent strokes', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      const opacityInput = painterWidget
        .getByTestId('painter-color-row')
        .locator('input[type="number"]')

      await opacityInput.fill('50')
      await opacityInput.press('Tab')
      await expect(opacityInput).toHaveValue('50')

      await drawStroke(comfyPage.page, canvas)

      await expect
        .poll(
          () =>
            canvas.evaluate((el: HTMLCanvasElement) => {
              const ctx = el.getContext('2d')
              if (!ctx) return false
              const cx = Math.floor(el.width / 2)
              const cy = Math.floor(el.height / 2)
              const { data } = ctx.getImageData(cx - 20, cy - 20, 40, 40)
              for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 50 && data[i] < 230) return true
              }
              return false
            }),
          {
            message: 'stroke should have semi-transparent pixels at 50% opacity'
          }
        )
        .toBe(true)
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
      ).toBeHidden()
    })

    test('Width slider resizes the canvas element', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      const widthSlider = painterWidget
        .getByTestId('painter-width-row')
        .getByRole('slider')

      const initialWidth = await canvas.evaluate(
        (el: HTMLCanvasElement) => el.width
      )
      expect(initialWidth, 'canvas should start at default width').toBe(512)

      await widthSlider.focus()
      await widthSlider.press('ArrowRight')

      await expect
        .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBe(576)
    })

    test('Background color picker updates the canvas container', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const bgColorInput = painterWidget
        .getByTestId('painter-bg-color-row')
        .locator('input[type="color"]')
      const canvasContainer = painterWidget.getByTestId(
        'painter-canvas-container'
      )

      await bgColorInput.evaluate((el: HTMLInputElement) => {
        el.value = '#ff0000'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })

      await expect(canvasContainer).toHaveCSS(
        'background-color',
        'rgb(255, 0, 0)'
      )
    })

    test(
      'Resize preserves existing drawing',
      { tag: ['@smoke', '@screenshot'] },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes.getNodeLocator('1')
        const painterWidget = node.locator('.widget-expands')
        const canvas = painterWidget.locator('canvas')
        const widthSlider = painterWidget
          .getByTestId('painter-width-row')
          .getByRole('slider')

        await drawStroke(comfyPage.page, canvas)
        await expect
          .poll(() => hasCanvasContent(canvas), {
            message: 'canvas must have content before resize'
          })
          .toBe(true)

        await widthSlider.focus()
        await widthSlider.press('ArrowRight')

        await expect
          .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width))
          .toBe(576)

        await expect.poll(() => hasCanvasContent(canvas)).toBe(true)
        await expect(node).toHaveScreenshot('painter-after-resize.png')
      }
    )
  })

  test.describe('Clear', () => {
    test(
      'Clear removes all drawn content',
      { tag: '@smoke' },
      async ({ comfyPage }) => {
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

        const clearButton = painterWidget.getByTestId('painter-clear-button')
        await clearButton.dispatchEvent('click')

        await expect
          .poll(() => hasCanvasContent(canvas), {
            message: 'canvas should be clear after click'
          })
          .toBe(false)
      }
    )
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

  test.describe('Eraser', () => {
    test('Eraser removes previously drawn content', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const painterWidget = node.locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      await expect(canvas).toBeVisible()

      await drawStroke(comfyPage.page, canvas)
      await comfyPage.nextFrame()
      await expect.poll(() => hasCanvasContent(canvas)).toBe(true)

      await painterWidget.getByRole('button', { name: 'Eraser' }).click()
      await drawStroke(comfyPage.page, canvas)
      await comfyPage.nextFrame()

      await expect
        .poll(
          () =>
            canvas.evaluate((el: HTMLCanvasElement) => {
              const ctx = el.getContext('2d')
              if (!ctx) return false
              const cx = Math.floor(el.width / 2)
              const cy = Math.floor(el.height / 2)
              const { data } = ctx.getImageData(cx - 5, cy - 5, 10, 10)
              return data.every((v, i) => i % 4 !== 3 || v === 0)
            }),
          { message: 'erased area should be transparent' }
        )
        .toBe(true)
    })

    test('Eraser on empty canvas adds no content', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const painterWidget = node.locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')
      await expect(canvas).toBeVisible()

      await painterWidget.getByRole('button', { name: 'Eraser' }).click()
      await drawStroke(comfyPage.page, canvas)
      await comfyPage.nextFrame()

      await expect.poll(() => hasCanvasContent(canvas)).toBe(false)
    })
  })

  test('Multiple strokes accumulate on the canvas', async ({ comfyPage }) => {
    const canvas = comfyPage.vueNodes
      .getNodeLocator('1')
      .locator('.widget-expands canvas')
    await expect(canvas).toBeVisible()

    await drawStroke(comfyPage.page, canvas, { yPct: 0.3 })
    await comfyPage.nextFrame()
    await expect.poll(() => hasCanvasContent(canvas)).toBe(true)

    await drawStroke(comfyPage.page, canvas, { yPct: 0.7 })
    await comfyPage.nextFrame()
    await expect.poll(() => hasCanvasContent(canvas)).toBe(true)
  })
})
