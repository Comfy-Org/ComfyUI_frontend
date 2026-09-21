import { expect, mergeTests } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'
import { assetApiFixture } from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  STABLE_CHECKPOINT,
  STABLE_INPUT_IMAGE
} from '@e2e/fixtures/data/assetFixtures'
import type { AssetHelper } from '@e2e/fixtures/helpers/AssetHelper'
import { withAsset, withDeleteFailure } from '@e2e/fixtures/helpers/AssetHelper'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

export const DROPPED_FILE = 'image64x64.webp'
export const TARGET_ASSET: Asset = {
  ...STABLE_INPUT_IMAGE,
  name: DROPPED_FILE,
  mime_type: 'image/webp'
}
export const TARGET_CARD_TEXT = TARGET_ASSET.name.replace(/\.[^.]+$/, '')
const imageFixture = base.extend<{
  assetApi: AssetHelper
  comfyPage: ComfyPage
  loadImageNode: NodeReference
  assetMock: { readonly deleteCalls: ReadonlyArray<string> }
  deleteStatus: number
}>({
  deleteStatus: [204, { option: true }],
  assetMock: [
    async ({ assetApi, deleteStatus }, use) => {
      assetApi.configure(
        withAsset(STABLE_CHECKPOINT),
        withAsset(TARGET_ASSET),
        ...(deleteStatus === 204 ? [] : [withDeleteFailure(deleteStatus)])
      )
      await assetApi.mock()
      await use({
        get deleteCalls() {
          return assetApi
            .getMutations()
            .filter(({ method }) => method === 'DELETE')
            .map(({ endpoint }) => endpoint.split('/').pop() ?? '')
        }
      })
    },
    { auto: true }
  ],
  loadImageNode: async ({ comfyPage }, use) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    const node = await comfyPage.nodeOps.getNodeRefById('10')
    const { x, y } = await node.getPosition()
    await comfyPage.dragDrop.dragAndDropFile(DROPPED_FILE, {
      dropPosition: { x, y },
      waitForUpload: true
    })
    const imageWidget = await node.getWidget(0)
    await expect.poll(() => imageWidget.getValue()).toBe(DROPPED_FILE)
    await expect
      .poll(() =>
        comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)
          return node?.imgs?.length ?? 0
        }, node.id)
      )
      .toBeGreaterThan(0)

    await comfyPage.page.evaluate(() => {
      const tracker =
        window.app!.extensionManager.workflow.activeWorkflow!.changeTracker
      tracker.reset()
      tracker.updateModified()
    })
    await expect
      .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
      .toBe(false)

    const sidebar = comfyPage.menu.assetsTab
    await sidebar.open({ waitForAssets: false })
    await sidebar.switchToImported()
    await sidebar.waitForAssets(1)
    await use(node)
  }
})

export const assetDeleteImageFixture = mergeTests(
  comfyPageFixture,
  assetApiFixture,
  imageFixture
)
