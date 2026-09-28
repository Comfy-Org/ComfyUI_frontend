import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

test.describe('Agent canvas primitives', { tag: '@agent' }, () => {
  test('select-only preserves the semantic workflow graph', async ({
    comfyPage
  }) => {
    const node = await comfyPage.nodeOps.getFirstNodeRef()
    expect(node).not.toBeNull()
    if (!node) return

    const before = await comfyPage.nodeOps.getSerializedGraph()
    await node.click('title')

    await expect
      .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
      .toBe(1)
    await expect
      .poll(() => comfyPage.nodeOps.getSerializedGraph())
      .toEqual(before)
  })

  test('focuses a known node without changing its graph data', async ({
    comfyPage
  }) => {
    const node = await comfyPage.nodeOps.getFirstNodeRef()
    expect(node).not.toBeNull()
    if (!node) return

    // Push the node away from the centre first, otherwise the assertions below
    // hold even if centerOnNode() does nothing at all.
    await comfyPage.canvasOps.shiftViewport(-400, -250)
    const view = (await comfyPage.canvas.boundingBox())!
    const centre = { x: view.x + view.width / 2, y: view.y + view.height / 2 }
    const offCentre = await comfyPage.canvasOps.getNodeCenterOnScreen(node.id)
    expect(
      Math.hypot(offCentre.x - centre.x, offCentre.y - centre.y),
      'node starts off-centre'
    ).toBeGreaterThan(100)

    const before = await comfyPage.nodeOps.getSerializedGraphWithoutViewport()
    await node.centerOnNode()

    const centred = await comfyPage.canvasOps.getNodeCenterOnScreen(node.id)
    expect(centred.x, 'node centred horizontally').toBeCloseTo(centre.x, -1)
    expect(centred.y, 'node centred vertically').toBeCloseTo(centre.y, -1)
    expect(await comfyPage.nodeOps.getSerializedGraphWithoutViewport()).toEqual(
      before
    )
  })

  test('fits the complete graph when a node is selected', async ({
    comfyPage
  }) => {
    const node = await comfyPage.nodeOps.getFirstNodeRef()
    expect(node).not.toBeNull()
    if (!node) return
    await node.click('title')

    // Zoom past the point where the graph fits, so the fit has work to do.
    await comfyPage.canvasOps.setScale(3)
    expect(
      await comfyPage.canvasOps.getNodesOutsideViewportCount(),
      'graph does not fit before the call'
    ).toBeGreaterThan(0)

    await fitToViewInstant(comfyPage)

    expect(
      await comfyPage.canvasOps.getNodesOutsideViewportCount(),
      'every node is in view after the call'
    ).toBe(0)
  })

  test('moves one selected node and keeps its connection slots aligned', async ({
    comfyPage
  }) => {
    const node = await comfyPage.nodeOps.getFirstNodeRef()
    expect(node).not.toBeNull()
    if (!node) return

    const before = await comfyPage.canvasOps.getNodeGeometry(node.id)
    const position = await node.getPosition()
    await comfyPage.canvasOps.dragAndDrop(position, {
      x: position.x + 40,
      y: position.y + 20
    })
    const after = await comfyPage.canvasOps.getNodeGeometry(node.id)

    comfyPage.canvasOps.expectSlotsTrackedNode(after, before)
  })
})
