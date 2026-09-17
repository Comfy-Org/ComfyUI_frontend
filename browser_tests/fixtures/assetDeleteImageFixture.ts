import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

const imageFixture = base.extend<{
  comfyPage: ComfyPage
  loadImageNode: NodeReference
}>({
  loadImageNode: async ({ comfyPage }, use) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    const node = await comfyPage.nodeOps.getNodeRefById('10')
    const { x, y } = await node.getPosition()
    await comfyPage.dragDrop.dragAndDropFile('image64x64.webp', {
      dropPosition: { x, y },
      waitForUpload: true
    })
    const imageWidget = await node.getWidget(0)
    await expect.poll(() => imageWidget.getValue()).toBe('image64x64.webp')
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
  imageFixture
)
