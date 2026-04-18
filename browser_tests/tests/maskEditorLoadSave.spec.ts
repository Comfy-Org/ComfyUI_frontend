import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Mask Editor load/save', { tag: '@vue-nodes' }, () => {
  async function loadImageOnNode(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const loadImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    )[0]
    expect(loadImageNode, 'Expected at least one LoadImage node').toBeTruthy()
    const { x, y } = await loadImageNode.getPosition()

    await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y }
    })

    const imagePreview = comfyPage.page.locator('.image-preview')
    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.locator('img')).toBeVisible()
    await expect(imagePreview).toContainText('x')

    return {
      imagePreview,
      nodeId: String(loadImageNode.id)
    }
  }

  async function openMaskEditorDialog(comfyPage: ComfyPage) {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    await imagePreview.getByRole('region').hover()
    await comfyPage.page.getByLabel('Edit or mask image').click()

    const dialog = comfyPage.page.locator('.mask-editor-dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('heading', { name: 'Mask Editor' })
    ).toBeVisible()

    const canvasContainer = dialog.locator('#maskEditorCanvasContainer')
    await expect(canvasContainer).toBeVisible()
    await expect(canvasContainer.locator('canvas')).toHaveCount(4)

    return dialog
  }

  function getCanvasPixelData(page: Page, canvasIndex: number) {
    return page.evaluate((idx) => {
      const canvases = document.querySelectorAll(
        '#maskEditorCanvasContainer canvas'
      )
      const canvas = canvases[idx] as HTMLCanvasElement
      if (!canvas) return null
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let nonTransparentPixels = 0
      for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] > 0) nonTransparentPixels++
      }
      return { nonTransparentPixels, totalPixels: data.data.length / 4 }
    }, canvasIndex)
  }

  function pollMaskPixelCount(page: Page): Promise<number> {
    return getCanvasPixelData(page, 2).then((d) => d?.nonTransparentPixels ?? 0)
  }

  async function drawStrokeOnPointerZone(
    page: Page,
    dialog: ReturnType<typeof page.locator>
  ) {
    const pointerZone = dialog.locator(
      '.maskEditor-ui-container [class*="w-[calc"]'
    )
    await expect(pointerZone).toBeVisible()

    const box = await pointerZone.boundingBox()
    if (!box) throw new Error('Pointer zone bounding box not found')

    const startX = box.x + box.width * 0.3
    const startY = box.y + box.height * 0.5
    const endX = box.x + box.width * 0.7
    const endY = box.y + box.height * 0.5

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 10 })
    await page.mouse.up()

    return { startX, startY, endX, endY, box }
  }

  async function drawStrokeAndExpectPixels(
    comfyPage: ComfyPage,
    dialog: ReturnType<typeof comfyPage.page.locator>
  ) {
    await drawStrokeOnPointerZone(comfyPage.page, dialog)
    await expect
      .poll(() => pollMaskPixelCount(comfyPage.page))
      .toBeGreaterThan(0)
  }

  async function openDialogFromImagePreview(comfyPage: ComfyPage) {
    const imagePreview = comfyPage.page.locator('.image-preview')
    await imagePreview.getByRole('region').hover()
    await comfyPage.page.getByLabel('Edit or mask image').click()
    const dialog = comfyPage.page.locator('.mask-editor-dialog')
    await expect(dialog).toBeVisible()
    return dialog
  }

  async function getCanvasDimensions(page: Page, index: number) {
    return page.evaluate((canvasIndex) => {
      const canvases = document.querySelectorAll(
        '#maskEditorCanvasContainer canvas'
      )
      const canvas = canvases[canvasIndex] as HTMLCanvasElement
      if (!canvas) return null
      return { width: canvas.width, height: canvas.height }
    }, index)
  }

  function getCanvasNonTransparentPixels(
    page: Page,
    index: number
  ): Promise<number | null> {
    return getCanvasPixelData(page, index).then(
      (d) => d?.nonTransparentPixels ?? null
    )
  }

  test('Save with drawn mask uploads non-empty mask data', async ({
    comfyPage
  }) => {
    const dialog = await openMaskEditorDialog(comfyPage)
    await drawStrokeAndExpectPixels(comfyPage, dialog)

    let observedContentType = ''
    let observedBodyLength = 0

    await comfyPage.page.route('**/upload/mask', async (route) => {
      const request = route.request()
      observedContentType = (await request.headerValue('content-type')) ?? ''
      observedBodyLength = request.postDataBuffer()?.byteLength ?? 0

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'clipspace-mask-123.png',
          subfolder: 'clipspace',
          type: 'input'
        })
      })
    })

    await comfyPage.page.route('**/upload/image', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'clipspace-painted-123.png',
          subfolder: 'clipspace',
          type: 'input'
        })
      })
    )

    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    expect(observedContentType).toContain('multipart/form-data')
    expect(observedBodyLength).toBeGreaterThan(256)
  })

  test('Save and reopen preserves mask state', async ({ comfyPage }) => {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    await imagePreview.getByRole('region').hover()
    await comfyPage.page.getByLabel('Edit or mask image').click()

    const dialog = comfyPage.page.locator('.mask-editor-dialog')
    await expect(dialog).toBeVisible()

    await drawStrokeAndExpectPixels(comfyPage, dialog)

    let maskUploadCount = 0
    let imageUploadCount = 0

    await comfyPage.page.route('**/upload/mask', (route) => {
      maskUploadCount++
      const name =
        maskUploadCount === 1
          ? 'clipspace-mask-456.png'
          : 'clipspace-painted-masked-456.png'

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name,
          subfolder: 'clipspace',
          type: 'input'
        })
      })
    })

    await comfyPage.page.route('**/upload/image', (route) => {
      imageUploadCount++
      const name =
        imageUploadCount === 1
          ? 'clipspace-paint-456.png'
          : 'clipspace-painted-456.png'

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name,
          subfolder: 'clipspace',
          type: 'input'
        })
      })
    })

    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    expect(maskUploadCount).toBeGreaterThanOrEqual(1)
    expect(imageUploadCount).toBeGreaterThanOrEqual(1)

    const reopenedDialog = await openDialogFromImagePreview(comfyPage)
    await expect
      .poll(() => pollMaskPixelCount(comfyPage.page))
      .toBeGreaterThan(0)
    await expect(reopenedDialog).toBeVisible()
  })

  test('Canvas dimensions match the loaded image', async ({ comfyPage }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    const imageDimensions = await getCanvasDimensions(comfyPage.page, 0)
    const maskDimensions = await getCanvasDimensions(comfyPage.page, 2)

    expect(imageDimensions).not.toBeNull()
    expect(maskDimensions).not.toBeNull()
    expect(imageDimensions?.width).toBeGreaterThan(0)
    expect(imageDimensions?.height).toBeGreaterThan(0)
    expect(imageDimensions).toEqual({ width: 64, height: 64 })
    expect(maskDimensions).toEqual({ width: 64, height: 64 })

    await expect(dialog).toBeVisible()
  })

  test('Opening mask editor loads the image onto the canvas', async ({
    comfyPage
  }) => {
    const dialog = await openMaskEditorDialog(comfyPage)

    await expect
      .poll(() => getCanvasNonTransparentPixels(comfyPage.page, 0))
      .toBeGreaterThan(0)

    await expect(dialog).toBeVisible()
  })

  test('Save failure on partial upload keeps dialog open', async ({
    comfyPage
  }) => {
    const dialog = await openMaskEditorDialog(comfyPage)
    await drawStrokeAndExpectPixels(comfyPage, dialog)

    let maskUploadHit = false
    let imageUploadHit = false
    await comfyPage.page.route('**/upload/mask', (route) => {
      maskUploadHit = true
      return route.fulfill({ status: 500 })
    })
    await comfyPage.page.route('**/upload/image', (route) => {
      imageUploadHit = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'clipspace-painted-999.png',
          subfolder: 'clipspace',
          type: 'input'
        })
      })
    })

    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await saveButton.click()

    await expect.poll(() => maskUploadHit).toBe(true)
    await expect.poll(() => imageUploadHit).toBe(true)
    await expect(dialog).toBeVisible()
    await expect(saveButton).toBeVisible()
  })
})
