import type { UploadImageResponse } from '@comfyorg/ingest-types'

import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  drawStroke,
  hasCanvasContent,
  triggerSerialization
} from '@e2e/fixtures/utils/painter'
import type { TestGraphAccess } from '@e2e/types/globals'

test.describe('Painter', { tag: ['@widget', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => window.app?.graph?.clear())
    await comfyPage.workflow.loadWorkflow('widgets/painter_widget')
  })

  test.describe('Widget rendering', { tag: ['@widget'] }, () => {
    test('Node enforces minimum size', async ({ comfyPage }) => {
      const size = await comfyPage.page.evaluate(() => {
        const graph = window.graph as TestGraphAccess | undefined
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
        const graph = window.graph as TestGraphAccess | undefined
        const node = graph?._nodes_by_id?.['1']
        return (node?.widgets ?? [])
          .filter((w) => ['width', 'height', 'bg_color'].includes(w.name))
          .map((w) => w.options.hidden ?? false)
      })
      expect(hiddenFlags).toEqual([true, true, true])
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
      await expect
        .poll(() => cursor.evaluate((el: HTMLElement) => el.style.transform))
        .not.toBe(transform1)

      await comfyPage.page.mouse.move(box.x + box.width + 50, box.y)
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
      await comfyPage.page.mouse.move(
        box.x + box.width + 20,
        box.y + box.height * 0.5
      )
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

      const hardnessDisplay = hardnessRow.getByTestId('painter-hardness-value')
      await expect(hardnessDisplay).toHaveText('100%')

      await hardnessSlider.focus()
      for (let i = 0; i < 10; i++) {
        await hardnessSlider.press('ArrowLeft')
      }

      await expect(hardnessDisplay).toHaveText('90%')
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
        // default 512 + slider step 64 = 576
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

    test('Clear on empty canvas is harmless', async ({ comfyPage }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
      const canvas = painterWidget.locator('canvas')

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas should start empty'
        })
        .toBe(false)

      await painterWidget
        .getByTestId('painter-clear-button')
        .dispatchEvent('click')

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'canvas should still be empty after clearing empty canvas'
        })
        .toBe(false)
    })
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

  test.describe('Serialization — unchanged canvas', () => {
    test(
      'Unchanged canvas does not re-upload on second serialization',
      { tag: '@slow' },
      async ({ comfyPage }) => {
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

        const canvas = comfyPage.vueNodes
          .getNodeLocator('1')
          .locator('.widget-expands canvas')

        await drawStroke(comfyPage.page, canvas)
        await triggerSerialization(comfyPage.page)
        expect(uploadCount, 'first serialization should upload once').toBe(1)

        await triggerSerialization(comfyPage.page)
        expect(
          uploadCount,
          'second serialization without new drawing should not re-upload'
        ).toBe(1)
      }
    )
  })

  test.describe('Settings persistence', () => {
    test('Tool selection is saved to node properties', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')

      await painterWidget.getByRole('button', { name: 'Eraser' }).click()

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(() => {
              const graph = window.graph as TestGraphAccess | undefined
              return graph?._nodes_by_id?.['1']?.properties?.painterTool as
                | string
                | undefined
            }),
          { message: 'painterTool property should update to eraser' }
        )
        .toBe('eraser')
    })

    test('Brush size change is saved to node properties', async ({
      comfyPage
    }) => {
      const sizeRow = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')
        .getByTestId('painter-size-row')
      const sizeSlider = sizeRow.getByRole('slider')

      await expect(
        sizeRow.getByTestId('painter-size-value'),
        'brush size should start at default 20'
      ).toHaveText('20')

      await sizeSlider.focus()
      for (let i = 0; i < 10; i++) {
        await sizeSlider.press('ArrowRight')
      }

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(() => {
              const graph = window.graph as TestGraphAccess | undefined
              return graph?._nodes_by_id?.['1']?.properties
                ?.painterBrushSize as number | undefined
            }),
          { message: 'painterBrushSize property should update to 30' }
        )
        .toBe(30)
    })
  })

  test('Controls collapse to single column in compact mode', async ({
    comfyPage
  }) => {
    const painterWidget = comfyPage.vueNodes
      .getNodeLocator('1')
      .locator('.widget-expands')
    const toolLabel = painterWidget.getByText('Tool', { exact: true })

    await expect(
      toolLabel,
      'tool label should be visible in two-column layout'
    ).toBeVisible()

    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess | undefined
      const node = graph?._nodes_by_id?.['1']
      if (node) {
        node.size = [200, 400]
        window.app!.canvas.setDirty(true, true)
      }
    })

    await expect(
      toolLabel,
      'tool label should hide in compact single-column layout'
    ).toBeHidden()
  })

  test('Multiple sequential strokes at different positions all accumulate', async ({
    comfyPage
  }) => {
    const canvas = comfyPage.vueNodes
      .getNodeLocator('1')
      .locator('.widget-expands canvas')
    await expect(canvas).toBeVisible()

    await drawStroke(comfyPage.page, canvas, { yPct: 0.25 })
    await drawStroke(comfyPage.page, canvas, { yPct: 0.5 })
    await drawStroke(comfyPage.page, canvas, { yPct: 0.75 })
    await comfyPage.nextFrame()

    const hasContentAtRow = (yFraction: number) =>
      canvas.evaluate((el: HTMLCanvasElement, y: number) => {
        const ctx = el.getContext('2d')
        if (!ctx) return false
        const cy = Math.floor(el.height * y)
        const { data } = ctx.getImageData(0, cy - 5, el.width, 10)
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true
        }
        return false
      }, yFraction)

    await expect
      .poll(() => hasContentAtRow(0.25), {
        message: 'top stroke should be present'
      })
      .toBe(true)
    await expect
      .poll(() => hasContentAtRow(0.5), {
        message: 'middle stroke should be present'
      })
      .toBe(true)
    await expect
      .poll(() => hasContentAtRow(0.75), {
        message: 'bottom stroke should be present'
      })
      .toBe(true)
  })
})

test.describe(
  'Painter — input image connection',
  { tag: ['@widget', '@vue-nodes', '@slow'] },
  () => {
    test.setTimeout(60_000)

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => window.app?.graph?.clear())
      await comfyPage.workflow.loadWorkflow('widgets/painter_with_input')
    })

    test('Width, height, and bg_color controls hide when input is connected', async ({
      comfyPage
    }) => {
      const painterWidget = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.widget-expands')

      await expect(
        painterWidget.getByTestId('painter-width-row'),
        'width row should be hidden when input is connected'
      ).toBeHidden()
      await expect(
        painterWidget.getByTestId('painter-height-row'),
        'height row should be hidden when input is connected'
      ).toBeHidden()
      await expect(
        painterWidget.getByTestId('painter-bg-color-row'),
        'background color row should be hidden when input is connected'
      ).toBeHidden()
      await expect(
        painterWidget.getByTestId('painter-dimension-text'),
        'dimension text should be visible when input is connected'
      ).toBeVisible()
    })

    test('Canvas resizes to match input image dimensions after execution', async ({
      comfyPage
    }) => {
      await comfyPage.runButton.click()

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const img = node.locator('.widget-expands img')
      await expect(
        img,
        'input image should appear after execution'
      ).toBeVisible({
        timeout: 30_000
      })

      await expect
        .poll(
          () =>
            img.evaluate(
              (el: HTMLImageElement) => el.complete && el.naturalWidth > 0
            ),
          {
            message: 'input image should be fully decoded',
            timeout: 30_000
          }
        )
        .toBe(true)

      const { nw, nh } = await img.evaluate((el: HTMLImageElement) => ({
        nw: el.naturalWidth,
        nh: el.naturalHeight
      }))

      const canvas = node.locator('.widget-expands canvas')
      await expect
        .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width), {
          message: 'canvas width should match input image natural width'
        })
        .toBe(nw)
      await expect
        .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.height), {
          message: 'canvas height should match input image natural height'
        })
        .toBe(nh)
    })

    test('Drawing over input image produces content on canvas', async ({
      comfyPage
    }) => {
      await comfyPage.runButton.click()

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const img = node.locator('.widget-expands img')
      await expect(
        img,
        'input image should appear after execution'
      ).toBeVisible({
        timeout: 30_000
      })
      await expect
        .poll(
          () =>
            img.evaluate(
              (el: HTMLImageElement) => el.complete && el.naturalWidth > 0
            ),
          { message: 'input image should be fully decoded', timeout: 30_000 }
        )
        .toBe(true)

      const nw = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
      const canvas = node.locator('.widget-expands canvas')
      await expect
        .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width), {
          message: 'canvas should resize to match input image width',
          timeout: 15_000
        })
        .toBe(nw)

      // Use dispatchEvent to bypass the LiteGraph canvas z-index overlay that
      // intercepts coordinate-based hit testing from page.mouse
      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas bounding box not found')
      const startX = box.x + box.width * 0.3
      const endX = box.x + box.width * 0.7
      const midY = box.y + box.height * 0.5
      const pointerOpts = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        isPrimary: true
      }
      await canvas.dispatchEvent('pointerdown', {
        ...pointerOpts,
        clientX: startX,
        clientY: midY
      })
      for (let i = 1; i <= 10; i++) {
        await canvas.dispatchEvent('pointermove', {
          ...pointerOpts,
          clientX: startX + (endX - startX) * (i / 10),
          clientY: midY
        })
      }
      await canvas.dispatchEvent('pointerup', {
        ...pointerOpts,
        clientX: endX,
        clientY: midY
      })

      await expect
        .poll(() => hasCanvasContent(canvas), {
          message: 'drawing over input image should produce canvas content'
        })
        .toBe(true)
    })
  }
)
