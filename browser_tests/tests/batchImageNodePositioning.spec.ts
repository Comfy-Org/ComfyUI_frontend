import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Batch Image Node Positioning', () => {
  test('Dropped image nodes should not overlap', async ({ comfyPage }) => {
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.dragDrop.dragAndDropFiles(
      ['image32x32.webp', 'image64x64.webp'],
      { waitForUploadCount: 2 }
    )

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 10000 })
      .toBe(initialCount + 3)

    const loadImageNodes =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    expect(loadImageNodes).toHaveLength(2)

    // Get bounding boxes via page.evaluate to read all node bounds atomically
    const boundingBoxes = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph
      const loadImageNodes = graph.nodes.filter((n) => n.type === 'LoadImage')
      return loadImageNodes.map((node) => {
        const [x, y, w, h] = node.getBounding()
        return { x, y, width: w, height: h }
      })
    })

    expect(boundingBoxes).toHaveLength(2)

    // Assert: no two bounding boxes overlap
    for (let i = 0; i < boundingBoxes.length; i++) {
      for (let j = i + 1; j < boundingBoxes.length; j++) {
        const a = boundingBoxes[i]
        const b = boundingBoxes[j]

        const overlapsX = a.x < b.x + b.width && a.x + a.width > b.x
        const overlapsY = a.y < b.y + b.height && a.y + a.height > b.y
        const overlaps = overlapsX && overlapsY

        expect(
          overlaps,
          `Nodes ${i} and ${j} overlap! ` +
            `Node ${i}: (${a.x}, ${a.y}, ${a.width}x${a.height}), ` +
            `Node ${j}: (${b.x}, ${b.y}, ${b.width}x${b.height})`
        ).toBe(false)
      }
    }

    // Verify minimum spacing between consecutive nodes (sorted by Y position)
    const sorted = [...boundingBoxes].sort((a, b) => a.y - b.y)
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].y - (sorted[i].y + sorted[i].height)
      expect(
        gap,
        `Gap between nodes ${i} and ${i + 1} is ${gap}px, expected >= 10px`
      ).toBeGreaterThanOrEqual(10)
    }
  })
})
