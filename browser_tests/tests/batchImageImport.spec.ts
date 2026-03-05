import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Batch Image Import', () => {
  test('Dropping multiple images creates LoadImage nodes and a BatchImagesNode', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFiles(
      ['image32x32.webp', 'image64x64.webp'],
      { waitForUploadCount: 2 }
    )

    // Wait for all nodes to be created (2 LoadImage + 1 BatchImagesNode)
    await comfyPage.page.waitForFunction(
      (expected) => window.app?.graph?.nodes?.length === expected,
      initialCount + 3,
      { timeout: 10000 }
    )

    const loadImageNodes =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const batchNodes =
      await comfyPage.nodeOps.getNodeRefsByType('BatchImagesNode')

    // Expect exactly 2 new LoadImage nodes (default workflow may already have some)
    expect(loadImageNodes.length).toBeGreaterThanOrEqual(2)
    expect(batchNodes).toHaveLength(1)
  })

  test('Dropping a single image does not create a BatchImagesNode', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFile('image32x32.webp', {
      waitForUpload: true
    })

    await comfyPage.page.waitForFunction(
      (expected) => window.app?.graph?.nodes?.length === expected,
      initialCount + 1,
      { timeout: 10000 }
    )

    const batchNodes =
      await comfyPage.nodeOps.getNodeRefsByType('BatchImagesNode')
    expect(batchNodes).toHaveLength(0)
  })

  test('Batch image import can be undone as a single action', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFiles(
      ['image32x32.webp', 'image64x64.webp'],
      { waitForUploadCount: 2 }
    )

    await comfyPage.page.waitForFunction(
      (expected) => window.app?.graph?.nodes?.length === expected,
      initialCount + 3,
      { timeout: 10000 }
    )

    const afterDropCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(afterDropCount).toBe(initialCount + 3)

    // Undo should revert all nodes created by the batch import in one step
    await comfyPage.canvas.click()
    await comfyPage.keyboard.undo()

    await comfyPage.page.waitForFunction(
      (expected) => window.app?.graph?.nodes?.length === expected,
      initialCount,
      { timeout: 10000 }
    )

    const afterUndoCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(afterUndoCount).toBe(initialCount)
  })

  test('Undone batch image import can be redone', async ({ comfyPage }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFiles(
      ['image32x32.webp', 'image64x64.webp'],
      { waitForUploadCount: 2 }
    )

    await comfyPage.page.waitForFunction(
      (expected) => window.app?.graph?.nodes?.length === expected,
      initialCount + 3,
      { timeout: 10000 }
    )

    // Undo
    await comfyPage.canvas.click()
    await comfyPage.keyboard.undo()

    await comfyPage.page.waitForFunction(
      (expected) => window.app?.graph?.nodes?.length === expected,
      initialCount,
      { timeout: 10000 }
    )

    // Redo should restore all nodes
    await comfyPage.keyboard.redo()

    await comfyPage.page.waitForFunction(
      (expected) => window.app?.graph?.nodes?.length === expected,
      initialCount + 3,
      { timeout: 10000 }
    )

    const afterRedoCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(afterRedoCount).toBe(initialCount + 3)
  })
})
