import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.use({
  initialSettings: { 'Comfy.UseNewMenu': 'Disabled' }
})

interface Point {
  x: number
  y: number
}

/** Converts a graph-space point to viewport coordinates for pointer aiming. */
async function graphPointToClient(
  comfyPage: ComfyPage,
  point: Point
): Promise<Point> {
  return comfyPage.page.evaluate(({ x, y }) => {
    const canvas = window.app!.canvas
    const rect = canvas.canvas.getBoundingClientRect()
    const { scale, offset } = canvas.ds
    return {
      x: rect.left + (x + offset[0]) * scale,
      y: rect.top + (y + offset[1]) * scale
    }
  }, point)
}

/** Graph-space midpoint of the first rendered link — pointer aiming only. */
async function firstLinkMidpoint(comfyPage: ComfyPage): Promise<Point> {
  const handle = await comfyPage.page.waitForFunction(() => {
    const link = window.app!.graph!.links.values().next().value
    const pos = link?._pos
    return pos ? { x: pos[0], y: pos[1] } : null
  })
  const point = await handle.jsonValue()
  if (!point) throw new Error('Rendered link midpoint was not found')
  return point
}

/** Graph-space centre of the first hidden-link badge — pointer aiming only. */
async function firstBadgeCenter(comfyPage: ComfyPage): Promise<Point> {
  const handle = await comfyPage.page.waitForFunction(() => {
    const badge = window.app!.canvas.linkBadgeFrameState.hitAreas[0]
    return badge
      ? { x: badge.x + badge.width / 2, y: badge.y + badge.height / 2 }
      : null
  })
  const point = await handle.jsonValue()
  if (!point) throw new Error('Hidden link badge was not found')
  return point
}

/** Hides the link under `graphPoint` through the user-facing context menu. */
async function hideLinkViaMenu(
  comfyPage: ComfyPage,
  graphPoint: Point
): Promise<void> {
  const clientPoint = await graphPointToClient(comfyPage, graphPoint)
  await comfyPage.page.mouse.click(clientPoint.x, clientPoint.y, {
    button: 'right'
  })
  await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()
  await comfyPage.contextMenu.clickLitegraphMenuItem('Hide Link')
  await comfyPage.contextMenu.waitForHidden()
  await parkPointer(comfyPage)
}

/** Moves the pointer off the canvas so screenshots are cursor-independent. */
async function parkPointer(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.page.mouse.move(1, 1)
  await comfyPage.nextFrame()
}

test.describe('Hidden link badges', { tag: ['@canvas', '@screenshot'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('reroute/native_reroute')
  })

  test('hides, reveals, and restores a link from canvas gestures', async ({
    comfyPage
  }) => {
    await expect(comfyPage.canvas).toHaveScreenshot('link-visible.png')

    await hideLinkViaMenu(comfyPage, await firstLinkMidpoint(comfyPage))

    await expect(comfyPage.canvas).toHaveScreenshot('link-hidden.png')

    const badgeCenter = await graphPointToClient(
      comfyPage,
      await firstBadgeCenter(comfyPage)
    )
    await comfyPage.page.mouse.click(badgeCenter.x, badgeCenter.y, {
      button: 'right'
    })
    await expect(comfyPage.contextMenu.litegraphContextMenu).toBeVisible()
    await comfyPage.contextMenu.clickLitegraphMenuItem('Show Link')
    await comfyPage.contextMenu.waitForHidden()
    await parkPointer(comfyPage)

    await expect(comfyPage.canvas).toHaveScreenshot('link-visible.png')
  })

  test('persists hidden state through a serialize and load round-trip', async ({
    comfyPage
  }) => {
    await hideLinkViaMenu(comfyPage, await firstLinkMidpoint(comfyPage))

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    const serializedLink = serialized.links?.[0]
    if (!serializedLink) throw new Error('Exported workflow link was not found')
    const linkId = String(
      Array.isArray(serializedLink) ? serializedLink[0] : serializedLink.id
    )
    expect(serialized.extra?.linkPresentation).toEqual({
      [linkId]: { hidden: true }
    })

    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.nextFrame()

    await expect(comfyPage.canvas).toHaveScreenshot(
      'link-hidden-after-reload.png'
    )
  })
})
