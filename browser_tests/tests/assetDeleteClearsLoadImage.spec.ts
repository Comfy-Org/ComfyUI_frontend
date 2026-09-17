/**
 * FE-230: Deleting an asset must clear the Load Image node preview, widget
 * value, and mark the workflow dirty.
 *
 * Local run (requires cloud build of the frontend):
 *   pnpm build:cloud
 *   pnpm exec playwright test --project=cloud \
 *     browser_tests/tests/assetDeleteClearsLoadImage.spec.ts --reporter=list
 *
 * The cloud project is required because input-asset deletion is gated on
 * `isCloud === true` (see `useMediaAssetActions.deleteAssetApi`).
 */
import { expect } from '@playwright/test'

import {
  assetDeleteImageFixture as baseTest,
  DROPPED_FILE,
  TARGET_ASSET,
  TARGET_CARD_TEXT
} from '@e2e/fixtures/assetDeleteImageFixture'

baseTest.describe(
  'FE-230 asset delete clears Load Image preview',
  { tag: '@cloud' },
  () => {
    baseTest(
      'deleting an input asset clears widget value, preview cache, and marks workflow modified',
      async ({ comfyPage, assetMock, loadImageNode }) => {
        const imageWidget = await loadImageNode.getWidget(0)
        const sidebar = comfyPage.menu.assetsTab
        await baseTest.step('Delete the imported image', async () => {
          await sidebar.rightClickAsset(TARGET_CARD_TEXT)
          const deleteMenuItem = sidebar.contextMenuItem('Delete')
          await expect(deleteMenuItem).toBeVisible()
          await deleteMenuItem.click()
          await comfyPage.confirmDialog.click('delete')
        })

        // Mocked DELETE was issued.
        await expect
          .poll(() => assetMock.deleteCalls.includes(TARGET_ASSET.id))
          .toBe(true)

        // Widget value was cleared.
        await expect.poll(() => imageWidget.getValue()).toBe('')

        // Preview cache was cleared.
        await expect
          .poll(() =>
            comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.getNodeById(nodeId)
              return node?.imgs?.length ?? 0
            }, loadImageNode.id)
          )
          .toBe(0)

        // Workflow was marked dirty by changeTracker.captureCanvasState().
        await expect
          .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
          .toBe(true)
      }
    )

    baseTest.describe('Refused deletion', () => {
      baseTest.use({ deleteStatus: 500 })

      baseTest(
        'refused asset deletion preserves widget, preview, and workflow state',
        async ({ comfyPage, assetMock, loadImageNode }) => {
          const imageWidget = await loadImageNode.getWidget(0)
          const sidebar = comfyPage.menu.assetsTab
          await baseTest.step(
            'Attempt to delete the imported image',
            async () => {
              await sidebar.rightClickAsset(TARGET_CARD_TEXT)
              await sidebar.contextMenuItem('Delete').click()
              await comfyPage.confirmDialog.click('delete')
            }
          )

          await expect
            .poll(() => assetMock.deleteCalls)
            .toEqual([TARGET_ASSET.id])
          await expect(comfyPage.toast.toastErrors).toBeVisible()
          await expect(comfyPage.toast.toastSuccesses).toHaveCount(0)
          await expect.poll(() => imageWidget.getValue()).toBe(DROPPED_FILE)
          await expect
            .poll(() =>
              comfyPage.page.evaluate((nodeId) => {
                const node = window.app!.graph.getNodeById(nodeId)
                return node?.imgs?.length ?? 0
              }, loadImageNode.id)
            )
            .toBeGreaterThan(0)
          await expect
            .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
            .toBe(false)
          await expect(sidebar.assetCards).toHaveCount(1)
        }
      )
    })
  }
)
