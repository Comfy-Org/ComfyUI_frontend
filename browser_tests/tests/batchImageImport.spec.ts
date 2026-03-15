import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { WorkspaceStore } from '../types/globals'

test.describe('Batch Image Import', () => {
  test('Dropping multiple images creates LoadImage nodes and a BatchImagesNode', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFiles(
      ['image32x32.webp', 'image64x64.webp'],
      { waitForUploadCount: 2 }
    )

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 10000 })
      .toBe(initialCount + 3)

    const batchNodes =
      await comfyPage.nodeOps.getNodeRefsByType('BatchImagesNode')
    expect(batchNodes).toHaveLength(1)
  })

  test('Dropping a single image does not create a BatchImagesNode', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFile('image32x32.webp', {
      waitForUpload: true
    })

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 10000 })
      .toBe(initialCount + 1)

    const batchNodes =
      await comfyPage.nodeOps.getNodeRefsByType('BatchImagesNode')
    expect(batchNodes).toHaveLength(0)
  })

  test('Batch image import produces a single undo entry', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()
    const initialUndoSize = await comfyPage.workflow.getUndoQueueSize()

    await comfyPage.dragDrop.dragAndDropFiles(
      ['image32x32.webp', 'image64x64.webp'],
      { waitForUploadCount: 2 }
    )

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 10000 })
      .toBe(initialCount + 3)

    await expect
      .poll(() => comfyPage.workflow.getUndoQueueSize(), { timeout: 5000 })
      .toBe((initialUndoSize ?? 0) + 1)
  })

  test('Batch image import can be undone as a single action', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFiles(
      ['image32x32.webp', 'image64x64.webp'],
      { waitForUploadCount: 2 }
    )

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 10000 })
      .toBe(initialCount + 3)

    // Call undo directly on the change tracker to avoid keyboard focus issues
    await comfyPage.page.evaluate(async () => {
      const workflow = (window.app!.extensionManager as WorkspaceStore).workflow
        .activeWorkflow
      await workflow?.changeTracker.undo()
    })
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 10000 })
      .toBe(initialCount)
  })
})
