import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.describe(
  'Linked widget content',
  { tag: ['@subgraph', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.route('**/api/view?*', (route) =>
        route.fulfill({
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        })
      )
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-image-widget'
      )
      await comfyPage.vueNodes.enterSubgraph('11')
    })

    test('hides linked image controls, preview, and contextual actions until disconnect', async ({
      comfyPage
    }) => {
      const loadImage = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
      const linkedBounds = await loadImage.boundingBox()
      if (!linkedBounds) throw new Error('Load Image node has no bounds')

      const linkedPlaceholder = loadImage.root.getByTestId(
        TestIds.widgets.linkedPlaceholder
      )
      const linkedIndicator = loadImage.root.getByTestId(
        TestIds.widgets.linkedIndicator
      )
      await expect(linkedPlaceholder).toBeVisible()
      await expect(linkedIndicator).toBeVisible()
      for (const scale of [0.5, 2, 1]) {
        await comfyPage.canvasOps.setScale(scale)
        await expect
          .poll(async () => {
            const controlBounds = await linkedPlaceholder
              .locator('.widget-input-base')
              .boundingBox()
            const indicatorBounds = await linkedIndicator.boundingBox()
            if (!controlBounds || !indicatorBounds) return false

            return (
              indicatorBounds.x >= controlBounds.x &&
              indicatorBounds.y >= controlBounds.y &&
              indicatorBounds.x + indicatorBounds.width <=
                controlBounds.x + controlBounds.width &&
              indicatorBounds.y + indicatorBounds.height <=
                controlBounds.y + controlBounds.height
            )
          })
          .toBe(true)
      }
      await expect(
        loadImage.root.getByRole('button', {
          name: 'interior.png',
          exact: true
        })
      ).toHaveCount(0)
      await expect(loadImage.imagePreview).toHaveCount(0)
      expect(linkedBounds.height).toBeLessThan(240)

      await comfyPage.contextMenu.openForVueNode(loadImage.header)
      for (const name of [
        'Open Image',
        'Open in Mask Editor',
        'Copy Image',
        'Paste Image',
        'Save Image'
      ]) {
        await expect(comfyPage.contextMenu.menuItem(name)).toHaveCount(0)
      }
      await expect(comfyPage.contextMenu.menuItem('Bypass')).toBeVisible()
      await comfyPage.contextMenu.dismissPrimeVueMenu()

      const linkedWidgetRow = loadImage.root
        .getByTestId(TestIds.widgets.widget)
        .filter({
          has: comfyPage.page.getByTestId(TestIds.widgets.linkedPlaceholder)
        })
      await comfyPage.contextMenu.openFor(linkedWidgetRow)
      await expect(
        comfyPage.page.getByRole('menuitem', { name: /Favorite Widget/ })
      ).toHaveCount(0)
      await comfyPage.contextMenu.dismissPrimeVueMenu()

      const loadImageNode = await comfyPage.nodeOps.getNodeRefById('1')
      await (await loadImageNode.getInput(0)).removeLinks()
      await comfyPage.nextFrame()

      await expect(linkedPlaceholder).toHaveCount(0)
      await expect(linkedIndicator).toHaveCount(0)
      await expect(
        loadImage.root.getByRole('button', {
          name: 'Select image...',
          exact: true
        })
      ).toBeVisible()
      await expect(loadImage.imagePreview.locator('img')).toBeVisible()

      await comfyPage.contextMenu.openFor(
        loadImage.root.getByRole('button', {
          name: 'Select image...',
          exact: true
        })
      )
      await expect(comfyPage.contextMenu.menuItem('Paste Image')).toBeVisible()
      await expect(
        comfyPage.page.getByRole('menuitem', { name: /Favorite Widget/ })
      ).toBeVisible()
      await expect
        .poll(async () => (await loadImage.boundingBox())?.height ?? 0)
        .toBeGreaterThan(linkedBounds.height)
    })
  }
)
