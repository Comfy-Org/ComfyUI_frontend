import { copyFile } from 'node:fs/promises'

import type { UploadImageResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe('Vue Upload Widgets', { tag: '@vue-nodes' }, () => {
  test.describe('media selection', { tag: '@widget' }, () => {
    test.use({
      initialSettings: {
        'Comfy.Canvas.NavigationMode': 'custom',
        'Comfy.Canvas.LeftMouseClickBehavior': 'panning',
        'Comfy.Canvas.MouseWheelScroll': 'zoom'
      }
    })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    })

    test('keeps the image picker anchored while the canvas pans and zooms', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const trigger = node.getByRole('button', {
        name: 'image',
        exact: true
      })
      await expect(trigger).toContainText('example.png')
      await WidgetSelectDropdownFixture.fromTrigger(trigger).open()

      const menu = comfyPage.page.getByTestId(TestIds.widgets.formDropdownMenu)
      await expect(menu).toBeVisible()
      await comfyPage.canvasOps.pan({ x: 137, y: 83 }, { x: 700, y: 300 })
      await comfyPage.canvas.hover({ position: { x: 600, y: 300 } })
      await comfyPage.page.mouse.wheel(0, 200)
      await comfyPage.nextFrame()
      await expect(menu).toBeVisible()
      await expect(async () => {
        const triggerBox = await trigger.boundingBox()
        const menuBox = await menu.boundingBox()
        expect(triggerBox).not.toBeNull()
        expect(menuBox).not.toBeNull()
        const triggerRight = triggerBox!.x + triggerBox!.width
        const menuRight = menuBox!.x + menuBox!.width
        expect(Math.abs(menuRight - triggerRight)).toBeLessThanOrEqual(1)
        const gap = menuBox!.y - (triggerBox!.y + triggerBox!.height)
        expect(gap).toBeGreaterThanOrEqual(0)
        expect(gap).toBeLessThanOrEqual(16)
      }).toPass({ timeout: 5000 })

      await comfyPage.canvas.click({ position: { x: 700, y: 300 } })
      await expect(menu).toBeHidden()
    })

    test('renders each thumbnail size and remembers it across view changes', async ({
      comfyPage
    }) => {
      const { thumbnailSize, thumbnailSizes } = enMessages.widgets.uploadSelect
      const { gridView, listView } = enMessages.assetBrowser
      const trigger = comfyPage.vueNodes
        .getNodeByTitle('Load Image')
        .getByRole('button', { name: 'image', exact: true })
      await WidgetSelectDropdownFixture.fromTrigger(trigger).open()

      const menu = comfyPage.page.getByTestId(TestIds.widgets.formDropdownMenu)
      const image = menu.getByRole('img', { name: 'example.png', exact: true })
      const sizeButton = menu.getByRole('button', { name: thumbnailSize })
      const preset = (name: string) =>
        comfyPage.page.getByRole('button', { name, exact: true })
      const width = async () => (await image.boundingBox())?.width ?? 0

      await expect(image).toBeVisible()
      const standardWidth = await width()
      await sizeButton.click()
      await expect(preset(thumbnailSizes.standard)).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await preset(thumbnailSizes.large).click()
      await expect.poll(width).toBeGreaterThanOrEqual(standardWidth * 4)

      await sizeButton.click()
      await preset(thumbnailSizes.compact).click()
      await expect(image).toBeVisible()
      await expect.poll(width).toBeLessThan(standardWidth)
      const compactWidth = await width()

      await menu.getByRole('button', { name: listView }).click()
      await expect(sizeButton).toBeHidden()
      await menu.getByRole('button', { name: gridView }).click()
      await expect.poll(width).toBeCloseTo(compactWidth, 0)
      await sizeButton.click()
      await expect(preset(thumbnailSizes.compact)).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    test.describe('in a viewport shorter than the image picker', () => {
      test.use({ viewport: { width: 1280, height: 520 } })

      test('fits the image picker without scrolling the panel itself', async ({
        comfyPage
      }) => {
        const dropdown = WidgetSelectDropdownFixture.fromTrigger(
          comfyPage.vueNodes
            .getNodeByTitle('Load Image')
            .getByRole('button', { name: 'image', exact: true })
        )
        await dropdown.open()

        await expect(dropdown.menu).toBeInViewport({ ratio: 1 })
        await expect.poll(() => dropdown.popoverScrolls()).toBe(false)
      })
    })

    test.describe('with room to grow the image picker', () => {
      test.use({ viewport: { width: 1280, height: 1000 } })

      test('resizes the image picker from its free corner', async ({
        comfyPage
      }) => {
        const dropdown = WidgetSelectDropdownFixture.fromTrigger(
          comfyPage.vueNodes
            .getNodeByTitle('Load Image')
            .getByRole('button', { name: 'image', exact: true })
        )
        await dropdown.open()
        await expect(dropdown.menu).toBeVisible()
        await expect(
          dropdown.popover,
          'Picker opens below the trigger, so dragging down grows it'
        ).toHaveAttribute('data-side', 'bottom')
        const box = async () => (await dropdown.popover.boundingBox())!
        const before = await box()

        await test.step('dragging the left corner past the viewport edge grows only down', async () => {
          await dropdown.dragResizeCorner(dropdown.leftResizeCorner, {
            x: -120,
            y: 80
          })
          await expect
            .poll(async () => (await box()).height)
            .toBeCloseTo(before.height + 80, 0)
          expect((await box()).width).toBeCloseTo(before.width, 0)
          await expect(dropdown.popover).toBeInViewport({ ratio: 1 })
          await expect(dropdown.menu).toBeVisible()
        })

        await test.step('dragging the right corner grows the panel right', async () => {
          const dragged = await box()
          await dropdown.dragResizeCorner(dropdown.rightResizeCorner, {
            x: 60,
            y: 0
          })
          await expect
            .poll(async () => (await box()).width)
            .toBeCloseTo(dragged.width + 60, 0)
          expect((await box()).x).toBeCloseTo(dragged.x, 0)
        })

        await test.step('arrow keys resize from a corner', async () => {
          const resized = await box()
          await dropdown.leftResizeCorner.focus()
          await comfyPage.page.keyboard.press('ArrowRight')
          await expect
            .poll(async () => (await box()).width)
            .toBeCloseTo(resized.width - 16, 0)
        })

        await test.step('dragging past the viewport stops at its edge', async () => {
          await dropdown.dragResizeCorner(dropdown.rightResizeCorner, {
            x: 2000,
            y: 2000
          })
          await expect(dropdown.popover).toBeInViewport({ ratio: 1 })
          await expect(dropdown.popover).toHaveAttribute('data-side', 'bottom')
        })

        await test.step('the other corner then shrinks the panel in place', async () => {
          const stretched = await box()
          await dropdown.dragResizeCorner(dropdown.leftResizeCorner, {
            x: 100,
            y: 0
          })
          await expect
            .poll(async () => (await box()).width)
            .toBeCloseTo(stretched.width - 100, 0)
          const shrunk = await box()
          expect(shrunk.x + shrunk.width).toBeCloseTo(
            stretched.x + stretched.width,
            0
          )
        })

        await test.step('double-clicking a corner restores the default size', async () => {
          await dropdown.rightResizeCorner.dblclick()
          await expect
            .poll(async () => (await box()).width)
            .toBeCloseTo(before.width, 0)
          await expect
            .poll(async () => (await box()).height)
            .toBeCloseTo(before.height, 0)
        })
      })

      test('keeps the image picker above its trigger while it shrinks', async ({
        comfyPage
      }) => {
        await comfyPage.canvasOps.pan({ x: 300, y: 450 }, { x: 700, y: 300 })
        const dropdown = WidgetSelectDropdownFixture.fromTrigger(
          comfyPage.vueNodes
            .getNodeByTitle('Load Image')
            .getByRole('button', { name: 'image', exact: true })
        )
        await dropdown.open()
        await expect(
          dropdown.popover,
          'Picker near the bottom of the viewport opens above the trigger'
        ).toHaveAttribute('data-side', 'top')
        const opened = (await dropdown.popover.boundingBox())!
        const shrunkHeight = 340

        await dropdown.dragResizeCorner(dropdown.leftResizeCorner, {
          x: 0,
          y: opened.height - shrunkHeight
        })

        await expect
          .poll(async () => (await dropdown.popover.boundingBox())!.height)
          .toBeCloseTo(shrunkHeight, 0)
        await expect(dropdown.popover).toHaveAttribute('data-side', 'top')
        const shrunk = (await dropdown.popover.boundingBox())!
        expect(shrunk.y + shrunk.height).toBeCloseTo(
          opened.y + opened.height,
          0
        )
      })
    })

    test('keeps a selected image loaded when it is selected again', async ({
      comfyPage
    }) => {
      const loadImageNodes =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      expect(loadImageNodes, 'Workflow has one Load Image node').toHaveLength(1)
      const [loadImageNode] = loadImageNodes

      const imageWidget = await loadImageNode.getWidgetByName('image')
      await expect.poll(() => imageWidget.getValue()).toBe('example.png')

      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const imageLoadError = node.getByTestId(TestIds.errors.imageLoadError)
      const selectedImageButton = node.getByRole('button', {
        name: 'image',
        exact: true
      })
      await expect(selectedImageButton).toBeVisible()
      await expect(selectedImageButton).toContainText('example.png')
      await expect(imageLoadError).toBeHidden()

      await WidgetSelectDropdownFixture.fromTrigger(
        selectedImageButton
      ).selectOption('example.png')

      await expect(selectedImageButton).toBeFocused()
      await expect(selectedImageButton).toBeVisible()
      await expect(selectedImageButton).toContainText('example.png')
      await expect.poll(() => imageWidget.getValue()).toBe('example.png')
      await expect(imageLoadError).toBeHidden()
    })
  })

  test('should hide canvas-only upload buttons', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/all_load_widgets')

    await expect(
      comfyPage.page.getByText('choose file to upload', { exact: true })
    ).toBeHidden()

    await expect
      .poll(() =>
        comfyPage.page.getByTestId(TestIds.errors.imageLoadError).count()
      )
      .toBeGreaterThan(0)
    await expect
      .poll(() =>
        comfyPage.page.getByTestId(TestIds.errors.videoLoadError).count()
      )
      .toBeGreaterThan(0)
  })

  test('uploads an EXR image', async ({ comfyPage, comfyFiles }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const [loadImageNode] =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const imageWidget = await loadImageNode.getWidgetByName('image')
    const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
    const filename = 'test_upload_image.exr'
    const uploadResponse = comfyPage.page.waitForResponse(
      (response) =>
        response.url().includes('/upload/image') && response.status() === 200
    )

    await node.locator('input[type="file"]').setInputFiles(assetPath(filename))
    comfyFiles.deleteAfterTest({ filename, type: 'input' })
    await uploadResponse

    await expect.poll(() => imageWidget.getValue()).toBe(filename)
    const imageTrigger = node.getByRole('button', {
      name: 'image',
      exact: true
    })
    await expect(imageTrigger).toBeVisible()
    await expect(imageTrigger).toContainText(filename)
    await expect(node.getByTestId(TestIds.errors.imageLoadError)).toBeHidden()
  })

  test('rejects an extensionless video and still uploads a valid one', async ({
    comfyPage
  }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()
    await comfyPage.searchBoxV2.addNode('Load Video')

    const [loadVideoNode] =
      await comfyPage.nodeOps.getNodeRefsByType('LoadVideo')
    expect(loadVideoNode, 'Load Video node was added').toBeDefined()
    const videoWidget = await loadVideoNode.getWidgetByName('file')
    const rejectionToasts = comfyPage.toast.toastWarnings.filter({
      hasText: enMessages.g.videoFilenameExtensionRequired
    })
    let uploadRequests = 0
    await comfyPage.page.route('**/upload/image', async (route) => {
      uploadRequests += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'clip.mp4' })
      })
    })

    await test.step('show feedback for a rejected canvas paste', async () => {
      await comfyPage.canvas.focus()
      await loadVideoNode.click('title')
      await comfyPage.page.evaluate(() => {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(
          new File(['video'], 'extensionless', { type: 'video/mp4' })
        )
        document.activeElement?.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          })
        )
      })

      await expect(rejectionToasts).toHaveCount(1)
      await expect(rejectionToasts.first()).toBeVisible()
      expect(uploadRequests).toBe(0)
    })

    const fileInput = comfyPage.vueNodes
      .getNodeByTitle('Load Video')
      .locator('input[type="file"]')

    await test.step('reject the extensionless video with actionable feedback', async () => {
      await fileInput.setInputFiles({
        name: 'extensionless',
        mimeType: 'video/mp4',
        buffer: Buffer.from('video')
      })

      await expect(rejectionToasts).toHaveCount(2)
      await expect(rejectionToasts.last()).toBeVisible()
      expect(uploadRequests).toBe(0)
    })

    await test.step('upload a valid video through the same control', async () => {
      await fileInput.setInputFiles({
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('video')
      })

      await expect.poll(() => videoWidget.getValue()).toBe('clip.mp4')
      expect(uploadRequests).toBe(1)
    })
  })

  test('rejects an extensionless video that the browser gives no MIME type', async ({
    comfyPage
  }, testInfo) => {
    const extensionlessVideoPath = testInfo.outputPath('extensionless')
    await copyFile(assetPath('plain_video.mp4'), extensionlessVideoPath)

    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()
    await comfyPage.searchBoxV2.addNode('Load Video')

    const rejectionToasts = comfyPage.toast.toastWarnings.filter({
      hasText: enMessages.g.videoFilenameExtensionRequired
    })
    const workflowLoadErrors = comfyPage.toast.withText(
      enMessages.toastMessages.fileLoadError.replace(
        '{fileName}',
        'extensionless'
      )
    )
    let uploadRequests = 0
    await comfyPage.page.route('**/upload/image', async (route) => {
      uploadRequests += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'extensionless' })
      })
    })

    const node = comfyPage.vueNodes.getNodeByTitle('Load Video')

    await test.step('reject the picked file without uploading', async () => {
      await node
        .locator('input[type="file"]')
        .setInputFiles(extensionlessVideoPath)

      await expect(rejectionToasts).toHaveCount(1)
      expect(uploadRequests).toBe(0)
    })

    await test.step('reject the file dropped onto the node', async () => {
      const box = await node.boundingBox()
      expect(box, 'Load Video node is rendered').not.toBeNull()
      await comfyPage.dragDrop.dragAndDropExternalResource({
        filePath: extensionlessVideoPath,
        fileType: '',
        dropPosition: {
          x: box!.x + box!.width / 2,
          y: box!.y + box!.height / 2
        }
      })

      await expect(rejectionToasts).toHaveCount(2)
      await expect(workflowLoadErrors).toHaveCount(0)
      expect(uploadRequests).toBe(0)
    })
  })

  test('shows a spinner during upload', async ({ comfyPage }) => {
    let releaseUpload: () => void = () => {}
    const uploadResponse: UploadImageResponse = { name: 'spinner-test.png' }

    await comfyPage.page.route('**/upload/image', async (route) => {
      await new Promise<void>((resolve) => {
        releaseUpload = resolve
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(uploadResponse)
      })
    })
    for (const nodeName of ['Load Image', 'Load Video', 'Load Audio']) {
      await test.step(`for ${nodeName}`, async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.nextFrame()
        await comfyPage.searchBoxV2.addNode(nodeName)

        const node = comfyPage.vueNodes.getNodeByTitle(nodeName)
        const fileInput = node.locator('input[type="file"]')
        const spinner = node.getByRole('status')

        await expect(spinner).toBeHidden()
        await fileInput.setInputFiles({
          name: 'spinner-test.png',
          mimeType: 'image/png',
          buffer: Buffer.from('test')
        })

        await expect(spinner).toBeVisible()
        releaseUpload()
        await expect(spinner).toBeHidden()
      })
    }
  })
})
