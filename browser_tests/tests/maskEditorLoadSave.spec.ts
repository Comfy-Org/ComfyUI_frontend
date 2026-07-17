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

  test('Reopening the editor after save restores the drawn mask', async ({
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()
    await maskEditor.drawStrokeAndExpectPixels(dialog)

    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()

    await maskEditor.reopenDialog()
    await expect.poll(() => maskEditor.pollMaskPixelCount()).toBeGreaterThan(0)
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
