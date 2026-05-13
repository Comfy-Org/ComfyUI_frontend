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

    await comfyPage.page.route('**/upload/mask', async (route) => {
      const request = route.request()
      observedContentType = (await request.headerValue('content-type')) ?? ''
      observedBodyLength = request.postDataBuffer()?.byteLength ?? 0
      await route.fulfill(
        fulfillJson(successResponse('clipspace-mask-123.png'))
      )
    })

    await comfyPage.page.route('**/upload/image', (route) =>
      route.fulfill(fulfillJson(successResponse('clipspace-painted-123.png')))
    )

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

  test('Save failure on partial upload keeps dialog open', async ({
    comfyPage,
    maskEditor
  }) => {
    const dialog = await maskEditor.openDialog()
    await maskEditor.drawStrokeAndExpectPixels(dialog)

    // The saver uploads sequentially: mask layer first, then image layers.
    // Let the mask upload succeed and the image upload fail to exercise both
    // endpoints and verify the dialog stays open after a partial failure.
    let maskUploadHit = false
    let imageUploadHit = false
    await comfyPage.page.route('**/upload/mask', (route) => {
      maskUploadHit = true
      return route.fulfill(
        fulfillJson(successResponse('clipspace-mask-999.png'))
      )
    })
    await comfyPage.page.route('**/upload/image', (route) => {
      imageUploadHit = true
      return route.fulfill({ status: 500 })
    })

    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await saveButton.click()

    await expect.poll(() => maskUploadHit).toBe(true)
    await expect.poll(() => imageUploadHit).toBe(true)
    await expect(dialog).toBeVisible()
    await expect(saveButton).toBeVisible()
  })
})
