import { mergeTests } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  getPromotedWidgetNames,
  getPromotedWidgetCountByName
} from '@e2e/fixtures/utils/promotedWidgets'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { previewImageNodeFixture } from '@e2e/fixtures/previewImageNodeFixture'
import { webSocketFixture } from '@e2e/fixtures/ws'
const wstest = mergeTests(test, webSocketFixture, previewImageNodeFixture)

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
        await expect(comfyPage.vueNodes.nodes).toHaveCount(7)

        const images = [{ filename: 'example.png', type: 'input' }]
        execution.executed(jobId, '2:1', { images })
        await comfyPage.nextFrame()

        await comfyPage.menu.topbar.getTab(1).click()
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

/** Returns the whole sequence so one assertion names the press that escaped. */
async function pressAndTrackFocus(
  comfyPage: ComfyPage,
  dialog: Locator,
  key: string,
  count: number
): Promise<boolean[]> {
  const focusStates: boolean[] = []
  for (let press = 0; press < count; press++) {
    await comfyPage.page.keyboard.press(key)
    focusStates.push(
      await dialog.evaluate(
        (element) =>
          !!document.activeElement && element.contains(document.activeElement)
      )
    )
  }
  return focusStates
}

test.describe('Vue Nodes Batch Image Preview', { tag: '@vue-nodes' }, () => {
  wstest(
    'Image previews tile to fit node',
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

      await test.step('Inject multiple previews', async () => {
        const file = { filename: 'example.png', type: 'input' }
        const images = new Array(100).fill(file)
        execution.executed('', '1', { images })
        await expect(node.imageGrid.locator('img')).toHaveCount(100)
      })

      // The node is already at its minimum width, so the narrow case has to be
      // reached by widening first and then shrinking back toward that floor.
      await expect.poll(() => countColumns(node.imageGrid)).toBe(10)

      await node.resizeFromCorner('SE', 400, 0)
      await expect.poll(() => countColumns(node.imageGrid)).toBeGreaterThan(10)
      const widestColumns = await countColumns(node.imageGrid)

      await node.resizeFromCorner('SE', -200, 0)
      await expect
        .poll(() => countColumns(node.imageGrid))
        .toBeLessThan(widestColumns)
      await expect.poll(() => countColumns(node.imageGrid)).toBeGreaterThan(10)
    }
  )

  wstest(
    'opens the lightbox when a grid image is double-clicked',
    async ({
      comfyPage,
      comfyMouse,
      getWebSocket,
      addPreviewImageNode,
      downloads
    }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const node = await addPreviewImageNode()
      const gridImages = node.imageGrid.locator('img')

      await test.step('Inject a multi-image grid', async () => {
        const images = [
          { filename: 'decoy-a.png', subfolder: '', type: 'input' },
          { filename: 'decoy-b.png', subfolder: '', type: 'input' },
          { filename: 'example.png', subfolder: '', type: 'input' },
          { filename: 'decoy-d.png', subfolder: '', type: 'input' }
        ]
        execution.executed('', '1', { images })
        await expect(gridImages).toHaveCount(4)
      })

      await expect(gridImages.first()).toHaveAttribute(
        'src',
        /[?&]preview=webp(%3B|;)75/
      )

      const nodeBoxBefore = await node.root.boundingBox()
      if (!nodeBoxBefore) throw new Error('node has no bounding box')
      const selectedBefore = await comfyPage.nodeOps.getSelectedNodeIds()

      await node.imageGrid
        .getByRole('button', { name: 'View image 3 of 4' })
        .dblclick()

      const lightbox = comfyPage.page.getByRole('dialog', { name: 'Gallery' })
      await expect(lightbox).toBeVisible()

      const lightboxImage = lightbox.locator('img').first()
      await expect(lightboxImage).toHaveAttribute(
        'src',
        /[?&]filename=example\.png/
      )
      await expect(lightboxImage).not.toHaveAttribute('src', /decoy-/)
      await expect(lightboxImage).not.toHaveAttribute('src', /[?&]preview=/)
      await expect(lightbox.getByLabel('Previous')).toBeVisible()
      await expect(lightbox.getByLabel('Next')).toBeVisible()

      expect(downloads).toEqual([])
      await expect(comfyPage.page.locator('.mask-editor-dialog')).toHaveCount(0)
      await expect(node.root).toHaveBounds(nodeBoxBefore)
      await expect
        .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
        .toEqual(selectedBefore)

      await comfyPage.page.keyboard.press('Escape')
      await expect(lightbox).toBeHidden()

      await test.step('dragging the live preview neither moves nor selects', async () => {
        const previewRegion = node.imagePreview.getByRole('region')
        await expect(previewRegion).toBeVisible()

        await comfyMouse.dragElementBy(previewRegion, { x: 40, y: 40 })

        await expect(node.root).toHaveBounds(nodeBoxBefore)
        await expect
          .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
          .toEqual(selectedBefore)
      })
    }
  )

  wstest(
    'opens the lightbox on a dense grid cell that the action bar covers',
    async ({ comfyPage, getWebSocket, addPreviewImageNode, downloads }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const node = await addPreviewImageNode()
      const gridImages = node.imageGrid.locator('img')

      await test.step('Inject a dense grid', async () => {
        const images = Array.from({ length: 16 }, (_unused, index) => ({
          filename: index === 1 ? 'example.png' : `decoy-${index}.png`,
          subfolder: '',
          type: 'input'
        }))
        execution.executed('', '1', { images })
        await expect(gridImages).toHaveCount(16)
      })

      const lightbox = comfyPage.page.getByRole('dialog', { name: 'Gallery' })

      await test.step('Double-click a cell the action bar overlaps', async () => {
        await node.imageGrid
          .getByRole('button', { name: 'View image 2 of 16' })
          .dblclick()

        await expect(lightbox).toBeVisible()
      })

      await test.step('The chosen cell opens at full resolution', async () => {
        const lightboxImage = lightbox.locator('img').first()
        await expect(lightboxImage).toHaveAttribute(
          'src',
          /[?&]filename=example\.png/
        )
        await expect(lightboxImage).not.toHaveAttribute('src', /decoy-/)
        await expect(lightboxImage).not.toHaveAttribute('src', /[?&]preview=/)
      })

      await test.step('No download or mask editor was triggered', async () => {
        expect(downloads).toEqual([])
        await expect(comfyPage.page.locator('.mask-editor-dialog')).toHaveCount(
          0
        )
      })

      await test.step('Escape closes the lightbox', async () => {
        await comfyPage.page.keyboard.press('Escape')
        await expect(lightbox).toBeHidden()
      })
    }
  )

  wstest(
    'stays open when the lightbox action button is double-clicked',
    async ({ comfyPage, getWebSocket, addPreviewImageNode }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const node = await addPreviewImageNode()

      const lightbox = comfyPage.page.getByRole('dialog', { name: 'Gallery' })

      await test.step('Show a single preview image', async () => {
        execution.executed('', '1', {
          images: [{ filename: 'example.png', subfolder: '', type: 'input' }]
        })
        await expect(node.imagePreview.locator('img').first()).toBeVisible()
      })

      await test.step('Double-click the trigger button', async () => {
        await node.imagePreview.getByRole('region').hover()
        await comfyPage.page
          .getByRole('button', { name: 'Open in lightbox' })
          .dblclick()
      })

      await test.step('The second click does not dismiss it', async () => {
        await comfyPage.nextFrame()
        await expect(lightbox).toBeVisible()
      })

      await test.step('Escape closes the lightbox', async () => {
        await comfyPage.page.keyboard.press('Escape')
        await expect(lightbox).toBeHidden()
      })
    }
  )

  for (const key of ['Tab', 'Shift+Tab'] as const) {
    wstest(
      `keeps focus inside the lightbox across repeated ${key}`,
      async ({ comfyPage, getWebSocket, addPreviewImageNode }) => {
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const node = await addPreviewImageNode()
        const gridImages = node.imageGrid.locator('img')

        await test.step('Open the lightbox on a four-image grid', async () => {
          execution.executed('', '1', {
            images: Array.from({ length: 4 }, (_unused, index) => ({
              filename: `example-${index}.png`,
              subfolder: '',
              type: 'input'
            }))
          })
          await expect(gridImages).toHaveCount(4)

          await node.imageGrid
            .getByRole('button', { name: 'View image 3 of 4' })
            .dblclick()
        })

        const lightbox = comfyPage.page.getByRole('dialog', { name: 'Gallery' })
        await expect(lightbox).toBeVisible()

        const focusStates = await pressAndTrackFocus(
          comfyPage,
          lightbox,
          key,
          5
        )

        expect(focusStates).toEqual([true, true, true, true, true])

        await comfyPage.page.keyboard.press('Escape')
        await expect(lightbox).toBeHidden()
      }
    )
  }

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
