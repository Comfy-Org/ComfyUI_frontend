import { expect, mergeTests } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  getPromotedWidgetNames,
  getPromotedWidgetCountByName
} from '@e2e/fixtures/utils/promotedWidgets'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { webSocketFixture } from '@e2e/fixtures/ws'
const wstest = mergeTests(test, webSocketFixture)

test.describe('Vue Nodes Image Preview', { tag: '@vue-nodes' }, () => {
  async function loadImageOnNode(comfyPage: ComfyPage) {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.searchBoxV2.addNode('Load Image')

    const loadImageNode = (
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    )[0]
    const { x, y } = await loadImageNode.getPosition()

    await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y }
    })

    const nodeId = String(loadImageNode.id)
    const { imagePreview } =
      await comfyPage.vueNodes.getFixtureByTitle('Load Image')

    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.locator('img')).toBeVisible({ timeout: 30_000 })
    await expect(imagePreview).toContainText('x')

    return {
      imagePreview,
      nodeId
    }
  }

  test('opens mask editor from image preview button', async ({ comfyPage }) => {
    const { imagePreview } = await loadImageOnNode(comfyPage)

    await imagePreview.getByRole('region').hover()
    await comfyPage.page.getByLabel('Edit or mask image').click()

    await expect(comfyPage.page.locator('.mask-editor-dialog')).toBeVisible()
  })

  test('hides mask and download buttons when image is missing', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'widgets/load_image_widget_missing_file'
    )

    const { imagePreview } =
      await comfyPage.vueNodes.getFixtureByTitle('Load Image')

    await expect(imagePreview).toBeVisible()
    await expect(imagePreview.getByTestId('error-loading-image')).toBeVisible()

    await imagePreview.getByRole('region').hover()

    await expect(imagePreview.getByLabel('Edit or mask image')).toHaveCount(0)
    await expect(imagePreview.getByLabel('Download image')).toHaveCount(0)
  })

  test('shows image context menu options', async ({ comfyPage }) => {
    const { nodeId } = await loadImageOnNode(comfyPage)

    await comfyPage.vueNodes.selectNode(nodeId)
    const nodeHeader = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-header')
    await nodeHeader.click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible()
    await expect(contextMenu.getByText('Open Image')).toBeVisible()
    await expect(contextMenu.getByText('Copy Image')).toBeVisible()
    await expect(contextMenu.getByText('Save Image')).toBeVisible()
    await expect(contextMenu.getByText('Open in Mask Editor')).toBeVisible()
  })

  test(
    'renders promoted image previews for each subgraph node',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-previews'
      )

      const firstSubgraphNode = comfyPage.vueNodes.getNodeLocator('7')
      const secondSubgraphNode = comfyPage.vueNodes.getNodeLocator('8')

      await expect(firstSubgraphNode).toBeVisible()
      await expect(secondSubgraphNode).toBeVisible()

      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, '7'))
        .toEqual(['$$canvas-image-preview', '$$canvas-image-preview'])
      await expect
        .poll(() => getPromotedWidgetNames(comfyPage, '8'))
        .toEqual(['$$canvas-image-preview'])

      await expect
        .poll(() =>
          getPromotedWidgetCountByName(comfyPage, '7', '$$canvas-image-preview')
        )
        .toBe(2)
      await expect
        .poll(() =>
          getPromotedWidgetCountByName(comfyPage, '8', '$$canvas-image-preview')
        )
        .toBe(1)

      await expect(firstSubgraphNode.locator('.lg-node-widgets')).toHaveCount(0)
      await expect(secondSubgraphNode.locator('.lg-node-widgets')).toHaveCount(
        0
      )

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

  wstest(
    'Displays previews inside subgraphs received while workflow inactive',
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const previewLocator = comfyPage.vueNodes.getNodeByTitle('Preview Image')
      const previewImage = new VueNodeFixture(previewLocator)
      const subgraphLocator = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      const subgraphNode = new VueNodeFixture(subgraphLocator)

      await test.step('Add node', async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.nextFrame()

        await comfyPage.searchBoxV2.addNode('Preview Image')
        await expect(previewImage.root).toBeVisible()
      })

      await test.step('Create subgraph', async () => {
        await previewImage.title.click()
        await comfyPage.page.keyboard.press('Control+Shift+e')
        await expect(subgraphNode.root).toBeVisible()
      })

      await test.step('Inject Previews from different tab', async () => {
        const jobId = await execution.run()
        await comfyPage.menu.topbar.getTab(0).click()
        await comfyPage.vueNodes.waitForNodes(7)

        const images = [{ filename: 'example.png', type: 'input' }]
        execution.executed(jobId, '2:1', { images })
        await comfyPage.nextFrame()

        await comfyPage.menu.topbar.getTab(1).click()
        await comfyPage.vueNodes.waitForNodes(1)
      })

      await expect(subgraphNode.imagePreview.locator('img')).toHaveCount(1)
    }
  )
})

async function countColumns(locator: Locator) {
  return await locator.locator('img').evaluateAll((images) => {
    const yOffsets = images.map((image) => image.getBoundingClientRect().y)
    return yOffsets.filter((yOffset) => yOffset === yOffsets[0]).length
  })
}

test.describe('Vue Nodes Batch Image Preview', { tag: '@vue-nodes' }, () => {
  wstest(
    'Image previews tile to fit node',
    async ({ comfyMouse, comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      await test.step('Add node', async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.nextFrame()

        await comfyPage.searchBoxV2.addNode('Preview Image')
        const previewImage = comfyPage.vueNodes.getNodeByTitle('Preview Image')
        await expect(previewImage).toBeVisible()
      })

      const node = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')

      await test.step('Inject multiple previews', async () => {
        const file = { filename: 'example.png', type: 'input' }
        const images = new Array(100).fill(file)
        execution.executed('', '1', { images })
        await expect(node.imageGrid.locator('img')).toHaveCount(100)
      })

      const { bottomRight } = node.resize
      await expect.poll(() => countColumns(node.imageGrid)).toBe(10)
      await comfyMouse.dragElementBy(bottomRight, { x: 200 })
      await expect.poll(() => countColumns(node.imageGrid)).toBeGreaterThan(10)
      await comfyMouse.dragElementBy(bottomRight, { x: -200, y: 200 })
      await expect.poll(() => countColumns(node.imageGrid)).toBeLessThan(10)
    }
  )

  wstest(
    'requests lightweight thumbnail URLs for grid cells',
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      await test.step('Add node', async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.nextFrame()

        await comfyPage.searchBoxV2.addNode('Preview Image')
        const previewImage = comfyPage.vueNodes.getNodeByTitle('Preview Image')
        await expect(previewImage).toBeVisible()
      })

      const node = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
      const gridImages = node.imageGrid.locator('img')

      await test.step('Inject a multi-image grid', async () => {
        const images = Array.from({ length: 4 }, (_, index) => ({
          filename: `grid-${index}.png`,
          subfolder: '',
          type: 'output'
        }))
        execution.executed('', '1', { images })
        await expect(gridImages).toHaveCount(4)
      })

      // FE-741: small on-node grid cells must request a server re-encoded
      // thumbnail (`preview=webp;75`, `;` may be percent-encoded) instead of
      // downloading the full-resolution image, while still pointing at the
      // real `/api/view` URL for that output. Verifies the full path: WS
      // output -> nodeOutputStore.buildImageUrls -> getGridThumbnailUrl ->
      // rendered grid `<img>`.
      for (const cell of await gridImages.all()) {
        await expect(cell).toHaveAttribute('src', /[?&]preview=webp(%3B|;)75/)
        await expect(cell).toHaveAttribute('src', /[?&]filename=grid-\d+\.png/)
      }
    }
  )
})
