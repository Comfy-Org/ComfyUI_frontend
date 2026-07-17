import { expect } from '@playwright/test'

import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'

interface UploadResponse {
  name: string
  subfolder: string
  type: 'input' | 'output' | 'temp'
}

const IMAGE_CANVAS_INDEX = 0
const MASK_CANVAS_INDEX = 2

const successResponse = (name: string): UploadResponse => ({
  name,
  subfolder: 'clipspace',
  type: 'input'
})

const fulfillJson = (body: UploadResponse) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

test.describe('Mask Editor load/save', { tag: '@vue-nodes' }, () => {
  test('Save with drawn mask uploads non-empty mask data', async ({
    comfyPage,
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()
    await maskEditor.drawStrokeAndExpectPixels(dialog)

    let observedContentType = ''
    let observedBodyLength = 0

    await comfyPage.page.route('**/upload/image', async (route) => {
      const request = route.request()
      if (!observedContentType) {
        observedContentType = (await request.headerValue('content-type')) ?? ''
        observedBodyLength = request.postDataBuffer()?.byteLength ?? 0
      }
      await route.fulfill(
        fulfillJson(successResponse('clipspace-mask-123.png'))
      )
    })

    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    expect(observedContentType).toContain('multipart/form-data')
    expect(observedBodyLength).toBeGreaterThan(256)
  })

  test('Canvas dimensions match the loaded image', async ({ maskEditor }) => {
    const dialog = await maskEditor.openDialog()

    const imageDimensions =
      await maskEditor.getCanvasPixelData(IMAGE_CANVAS_INDEX)
    const maskDimensions =
      await maskEditor.getCanvasPixelData(MASK_CANVAS_INDEX)

    expect(imageDimensions).not.toBeNull()
    expect(maskDimensions).not.toBeNull()
    expect(imageDimensions?.totalPixels).toBe(64 * 64)
    expect(maskDimensions?.totalPixels).toBe(64 * 64)

    await expect(dialog).toBeVisible()
  })

  test('Saving preserves image colors under the mask', async ({
    comfyPage,
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()
    await maskEditor.drawStrokeAndExpectPixels(dialog)

    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()

    const widgetValue = await comfyPage.page.evaluate(() => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'LoadImage')!
      return String(node.widgets!.find((w) => w.name === 'image')!.value)
    })

    // Compare the saved file's RGB (channel=rgb strips alpha server-side,
    // immune to canvas premultiply) against the original image inside the
    // masked region (taken from the saved file's alpha channel).
    const stats = await comfyPage.page.evaluate(async (annotatedValue) => {
      const [pathPart] = annotatedValue.split(' [')
      const slash = pathPart.lastIndexOf('/')
      const filename = slash === -1 ? pathPart : pathPart.slice(slash + 1)
      const subfolder = slash === -1 ? '' : pathPart.slice(0, slash)

      const loadPixels = async (params: Record<string, string>) => {
        const url = window.app!.api.apiURL(
          `/view?${new URLSearchParams(params)}`
        )
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`${url} -> ${resp.status}`)
        const bmp = await createImageBitmap(await resp.blob())
        const canvas = document.createElement('canvas')
        canvas.width = bmp.width
        canvas.height = bmp.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data
      }

      const saved = { filename, subfolder, type: 'input' }
      const [savedRgb, savedAlpha, original] = await Promise.all([
        loadPixels({ ...saved, channel: 'rgb' }),
        loadPixels({ ...saved, channel: 'a' }),
        loadPixels({
          filename: 'image64x64.webp',
          subfolder: '',
          type: 'input'
        })
      ])

      let maskedCount = 0
      let maxAbsoluteError = 0
      for (let i = 0; i < savedAlpha.length; i += 4) {
        const masked = savedAlpha[i + 3] < 128
        if (!masked) continue
        maskedCount++
        for (let channel = 0; channel < 3; channel++) {
          maxAbsoluteError = Math.max(
            maxAbsoluteError,
            Math.abs(savedRgb[i + channel] - original[i + channel])
          )
        }
      }
      return { maskedCount, maxAbsoluteError }
    }, widgetValue)

    expect(stats.maskedCount).toBeGreaterThan(0)
    expect(stats.maxAbsoluteError).toBe(0)
  })

  test('Save failure keeps dialog open', async ({ comfyPage, maskEditor }) => {
    const dialog = await maskEditor.openDialog()
    await maskEditor.drawStrokeAndExpectPixels(dialog)

    let imageUploadHit = false
    await comfyPage.page.route('**/upload/image', (route) => {
      imageUploadHit = true
      return route.fulfill({ status: 500 })
    })

    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await saveButton.click()

    await expect.poll(() => imageUploadHit).toBe(true)
    await expect(dialog).toBeVisible()
    await expect(saveButton).toBeVisible()
  })
})
