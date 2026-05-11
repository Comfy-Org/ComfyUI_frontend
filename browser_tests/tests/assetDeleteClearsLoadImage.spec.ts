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
import { expect, mergeTests } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import {
  assetApiFixture,
  createCloudAssetsFixture
} from '@e2e/fixtures/assetApiFixture'
import { STABLE_INPUT_IMAGE } from '@e2e/fixtures/data/assetFixtures'
import { withAsset } from '@e2e/fixtures/helpers/AssetHelper'

const TARGET_ASSET: Asset = STABLE_INPUT_IMAGE
const LOAD_IMAGE_NODE_ID = 10

const baseTest = mergeTests(
  createCloudAssetsFixture([TARGET_ASSET]),
  assetApiFixture
)

baseTest.describe(
  'FE-230 asset delete clears Load Image preview',
  { tag: '@cloud' },
  () => {
    baseTest.beforeEach(async ({ assetApi }) => {
      assetApi.configure(withAsset(TARGET_ASSET))
      await assetApi.mock()
    })

    baseTest(
      'deleting an input asset clears widget value, preview cache, and marks workflow modified',
      async ({ comfyPage, assetApi }) => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

        // Point the Load Image widget at the asset we are about to delete and
        // install a placeholder preview the same way the runtime would after a
        // successful load. The test is asserting that FE-230 tears these down.
        await comfyPage.page.evaluate(
          ({ nodeId, filename }) => {
            const node = window.app!.graph.getNodeById(nodeId)
            if (!node) throw new Error(`Node ${nodeId} not found`)
            const widget = node.widgets?.find((w) => w.name === 'image')
            if (!widget) throw new Error('image widget missing')
            widget.value = filename
            node.imgs = [new Image()]
          },
          { nodeId: LOAD_IMAGE_NODE_ID, filename: TARGET_ASSET.name }
        )

        // Re-baseline the change tracker so the deletion-side mutation is the
        // only thing that can flip `isModified` later.
        await comfyPage.page.evaluate(() => {
          const tracker =
            window.app?.extensionManager?.workflow?.activeWorkflow
              ?.changeTracker
          tracker?.reset?.()
        })
        await expect
          .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
          .toBe(false)

        // Drive the real production flow: assets sidebar → Imported tab →
        // right-click asset card → Delete → confirm dialog.
        const sidebar = comfyPage.menu.assetsTab
        await sidebar.open()
        await sidebar.switchToImported()
        await sidebar.waitForAssets(1)
        await sidebar.rightClickAsset(TARGET_ASSET.name)

        const deleteMenuItem = sidebar.contextMenuItem('Delete')
        await expect(deleteMenuItem).toBeVisible()
        await deleteMenuItem.click()

        const dialog = comfyPage.page.locator('.p-dialog').filter({
          has: comfyPage.page.getByRole('button', { name: /delete/i })
        })
        await expect(dialog).toBeVisible()
        const confirmDelete = dialog.getByRole('button', { name: /delete/i })
        await expect(confirmDelete).toBeVisible()
        await confirmDelete.click()
        await expect(dialog).toBeHidden()

        // Mocked DELETE was issued.
        await expect
          .poll(() =>
            assetApi
              .getMutations()
              .some(
                (m) =>
                  m.method === 'DELETE' &&
                  m.endpoint.endsWith(`/assets/${TARGET_ASSET.id}`)
              )
          )
          .toBe(true)

        // Widget value was cleared.
        await expect
          .poll(() =>
            comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.getNodeById(nodeId)
              const widget = node?.widgets?.find((w) => w.name === 'image')
              return widget?.value
            }, LOAD_IMAGE_NODE_ID)
          )
          .toBe('')

        // Preview cache was cleared.
        await expect
          .poll(() =>
            comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.getNodeById(nodeId)
              return node?.imgs?.length ?? 0
            }, LOAD_IMAGE_NODE_ID)
          )
          .toBe(0)

        // Workflow was marked dirty by changeTracker.captureCanvasState().
        await expect
          .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
          .toBe(true)
      }
    )
  }
)
