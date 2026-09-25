import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import type { NodeId } from '@/types/nodeId'

/**
 * `graph.serialize()` folds the viewport into `extra.ds`, so a test that only
 * cares about graph data has to drop it. Navigation is *supposed* to move the
 * viewport; comparing the raw serialization would flag that as a mutation.
 */
async function graphDataWithoutViewport(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const data = window.app!.graph.serialize() as unknown as Record<
      string,
      unknown
    >
    const extra = { ...(data.extra as Record<string, unknown> | undefined) }
    delete extra.ds
    return { ...data, extra }
  })
}

/** Centre of a node in client coordinates, i.e. where it actually renders. */
async function nodeCentreOnScreen(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const app = window.app!
    const node = app.canvas.graph!.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)
    const [x, y] = app.canvasPosToClientPos([
      node.pos[0] + node.size[0] / 2,
      node.pos[1] + node.size[1] / 2
    ])
    return { x, y }
  }, id)
}

/** How many nodes render fully or partly outside the canvas element. */
async function nodesOutsideViewport(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const app = window.app!
    const view = app.canvas.canvas.getBoundingClientRect()
    return app.graph.nodes.filter((node) => {
      const [left, top] = app.canvasPosToClientPos([node.pos[0], node.pos[1]])
      const [right, bottom] = app.canvasPosToClientPos([
        node.pos[0] + node.size[0],
        node.pos[1] + node.size[1]
      ])
      return (
        left < view.left ||
        top < view.top ||
        right > view.right ||
        bottom > view.bottom
      )
    }).length
  })
}

/**
 * Move the viewport without touching the graph or the selection. A simulated
 * drag would risk marquee-selecting, which is the thing under test elsewhere.
 */
async function shiftViewport(comfyPage: ComfyPage, dx: number, dy: number) {
  await comfyPage.page.evaluate(
    ({ dx, dy }) => {
      const ds = window.app!.canvas.ds
      ds.offset[0] += dx
      ds.offset[1] += dy
      window.app!.canvas.setDirty(true, true)
    },
    { dx, dy }
  )
  await comfyPage.nextFrame()
}

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
    await shiftViewport(comfyPage, -400, -250)
    const view = (await comfyPage.canvas.boundingBox())!
    const centre = { x: view.x + view.width / 2, y: view.y + view.height / 2 }
    const offCentre = await nodeCentreOnScreen(comfyPage, node.id)
    expect(
      Math.hypot(offCentre.x - centre.x, offCentre.y - centre.y),
      'node starts off-centre'
    ).toBeGreaterThan(100)

    const before = await graphDataWithoutViewport(comfyPage)
    await node.centerOnNode()

    const centred = await nodeCentreOnScreen(comfyPage, node.id)
    expect(centred.x, 'node centred horizontally').toBeCloseTo(centre.x, -1)
    expect(centred.y, 'node centred vertically').toBeCloseTo(centre.y, -1)
    expect(await graphDataWithoutViewport(comfyPage)).toEqual(before)
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
      await nodesOutsideViewport(comfyPage),
      'graph does not fit before the call'
    ).toBeGreaterThan(0)

    await fitToViewInstant(comfyPage)

    expect(
      await nodesOutsideViewport(comfyPage),
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
