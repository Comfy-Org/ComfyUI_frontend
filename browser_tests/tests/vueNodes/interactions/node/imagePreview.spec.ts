import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '../../../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../../../fixtures/ComfyPage'
import {
  getPromotedWidgetNames,
  getPromotedWidgetCountByName
} from '../../../../helpers/promotedWidgets'

test.describe('Vue Nodes Image Preview', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  })

  async function loadImageOnNode(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    await comfyPage.vueNodes.waitForNodes()

    const loadImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    )[0]
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

  async function openMaskEditorViaCommand(comfyPage: ComfyPage) {
    const { nodeId } = await loadImageOnNode(comfyPage)
    await comfyPage.vueNodes.selectNode(nodeId)
    await comfyPage.command.executeCommand('Comfy.MaskEditor.OpenMaskEditor')
    const dialog = comfyPage.page.locator('.mask-editor-dialog')
    await expect(dialog).toBeVisible()
    return dialog
  }

  async function drawStrokeOnMaskEditor(page: Page) {
    const pointerZone = page.locator('.maskEditor-ui-container').first()
    const box = await pointerZone.boundingBox()
    if (!box) throw new Error('PointerZone not found')
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, {
      steps: 10
    })
    await page.mouse.up()
  }

  // TODO(#8143): Re-enable after image preview sync is working in CI
  test.fixme('opens mask editor from image preview button', async ({
    comfyPage
  }) => {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    await imagePreview.locator('[role="img"]').focus()
    await comfyPage.page.getByLabel('Edit or mask image').click()

    await expect(comfyPage.page.locator('.mask-editor-dialog')).toBeVisible()
  })

  // TODO(#8143): Re-enable after image preview sync is working in CI
  test.fixme('shows image context menu options', async ({ comfyPage }) => {
    const { nodeId } = await loadImageOnNode(comfyPage)

    const nodeHeader = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-header')
    await nodeHeader.click()
    await nodeHeader.click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible()
    await expect(contextMenu.getByText('Open Image')).toBeVisible()
    await expect(contextMenu.getByText('Copy Image')).toBeVisible()
    await expect(contextMenu.getByText('Save Image')).toBeVisible()
    await expect(contextMenu.getByText('Open in Mask Editor')).toBeVisible()
  })

  test(
    'opens mask editor via command execution',
    { tag: ['@smoke'] },
    async ({ comfyPage }) => {
      const dialog = await openMaskEditorViaCommand(comfyPage)

      await expect(
        comfyPage.page.locator('.maskEditor-ui-container')
      ).toBeVisible()
      await expect(dialog.getByText('Mask Editor')).toBeVisible()
      await expect(dialog).toHaveScreenshot('mask-editor-open-via-command.png')
    }
  )

  test(
    'cancel closes mask editor dialog without uploading',
    { tag: ['@smoke'] },
    async ({ comfyPage }) => {
      const uploadRequests: string[] = []
      await comfyPage.page.route('**/upload/mask', (route) => {
        uploadRequests.push('mask')
        return route.continue()
      })
      await comfyPage.page.route('**/upload/image', (route) => {
        uploadRequests.push('image')
        return route.continue()
      })

      const dialog = await openMaskEditorViaCommand(comfyPage)
      await dialog.getByRole('button', { name: /cancel/i }).click()

      await expect(dialog).not.toBeVisible()
      expect(uploadRequests).toHaveLength(0)
    }
  )

  test(
    'save closes mask editor dialog and uploads mask',
    { tag: ['@smoke'] },
    async ({ comfyPage }) => {
      const uploadedPaths: string[] = []
      await comfyPage.page.route('**/upload/mask', async (route) => {
        const response = await route.fetch()
        const body = await response.json()
        if (body?.name) uploadedPaths.push(body.name)
        return route.fulfill({ response })
      })
      await comfyPage.page.route('**/upload/image', async (route) => {
        const response = await route.fetch()
        const body = await response.json()
        if (body?.name) uploadedPaths.push(body.name)
        return route.fulfill({ response })
      })

      const dialog = await openMaskEditorViaCommand(comfyPage)
      await drawStrokeOnMaskEditor(comfyPage.page)
      await expect(dialog).toHaveScreenshot('mask-editor-after-stroke.png')

      await dialog.getByRole('button', { name: /save/i }).click()

      await expect(dialog).not.toBeVisible()
      expect(uploadedPaths.length).toBeGreaterThan(0)
    }
  )

  test(
    'renders promoted image previews for each subgraph node',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-previews'
      )
      await comfyPage.vueNodes.waitForNodes()

      const firstSubgraphNode = comfyPage.vueNodes.getNodeLocator('7')
      const secondSubgraphNode = comfyPage.vueNodes.getNodeLocator('8')

      await expect(firstSubgraphNode).toBeVisible()
      await expect(secondSubgraphNode).toBeVisible()

      const firstPromotedWidgets = await getPromotedWidgetNames(comfyPage, '7')
      const secondPromotedWidgets = await getPromotedWidgetNames(comfyPage, '8')
      expect(firstPromotedWidgets).toEqual([
        '$$canvas-image-preview',
        '$$canvas-image-preview'
      ])
      expect(secondPromotedWidgets).toEqual(['$$canvas-image-preview'])

      expect(
        await getPromotedWidgetCountByName(
          comfyPage,
          '7',
          '$$canvas-image-preview'
        )
      ).toBe(2)
      expect(
        await getPromotedWidgetCountByName(
          comfyPage,
          '8',
          '$$canvas-image-preview'
        )
      ).toBe(1)

      await expect(
        firstSubgraphNode.locator('.lg-node-widgets')
      ).not.toContainText('$$canvas-image-preview')
      await expect(
        secondSubgraphNode.locator('.lg-node-widgets')
      ).not.toContainText('$$canvas-image-preview')

      await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      const firstPreviewImages = firstSubgraphNode.locator('.image-preview img')
      const secondPreviewImages =
        secondSubgraphNode.locator('.image-preview img')

      await expect(firstPreviewImages).toHaveCount(2, { timeout: 30_000 })
      await expect(secondPreviewImages).toHaveCount(1, { timeout: 30_000 })

      await expect(firstPreviewImages.first()).toBeVisible({ timeout: 30_000 })
      await expect(firstPreviewImages.nth(1)).toBeVisible({ timeout: 30_000 })
      await expect(secondPreviewImages.first()).toBeVisible({ timeout: 30_000 })

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-multiple-promoted-previews.png'
      )
    }
  )
})
