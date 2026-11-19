import { expect } from '@playwright/test'

import type { NodeId } from '@/types/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const NODE_GAP_PX = 1
const DRAG_DISTANCE_PX = 300
const BOTTOM_PANEL_DRAG_PX = 100

/** Grab offset inside the fine-pointer hit area, over the adjacent node. */
export const GRAB_OFFSET_PX = 4
/** Grab offset inside the coarse-pointer hit area, over the adjacent node. */
export const COARSE_GRAB_OFFSET_PX = 10

type NodeAnchor = 'titleLeft' | 'center'

async function placeNodeAt(
  comfyPage: ComfyPage,
  point: { x: number; y: number },
  anchor: NodeAnchor
) {
  const nodeId = await comfyPage.page.evaluate(
    ({ x, y, anchor }) => {
      const canvas = window.app!.canvas
      const node = window.app!.graph.nodes[0]
      const rect = canvas.canvas.getBoundingClientRect()
      const [graphX, graphY] = canvas.ds.convertCanvasToOffset([
        x - rect.left,
        y - rect.top
      ])
      node.pos =
        anchor === 'titleLeft'
          ? [graphX, graphY + window.LiteGraph!.NODE_TITLE_HEIGHT / 2]
          : [graphX - node.size[0] / 2, graphY - node.size[1] / 2]
      canvas.setDirty(true, true)
      return node.id
    },
    { ...point, anchor }
  )
  await comfyPage.nextFrame()
  return nodeId
}

async function expectNodeUnder(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  point: { x: number; y: number }
) {
  const covered = await comfyPage.page.evaluate(
    ({ id, x, y }) => {
      const canvas = window.app!.canvas
      const node = window.app!.graph.getNodeById(id)
      const rect = canvas.canvas.getBoundingClientRect()
      const [graphX, graphY] = canvas.ds.convertCanvasToOffset([
        x - rect.left,
        y - rect.top
      ])
      return node?.isPointInside(graphX, graphY) ?? false
    },
    { id: nodeId, ...point }
  )
  expect(covered).toBe(true)
}

async function nodePos(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)
    return [node.pos[0], node.pos[1]]
  }, nodeId)
}

/** Asserts a sidebar resize grabbed `grabOffset` px off the handle widens it without dragging the node beside it. */
export async function expectSidebarResizeLeavesNode(
  comfyPage: ComfyPage,
  grabOffset: number
) {
  await comfyPage.toast.closeToasts()
  await comfyPage.menu.nodeLibraryTab.open()
  const sidebar = comfyPage.menu.nodeLibraryTab.panel
  const initialWidth = (await sidebar.boundingBox())?.width ?? 0

  const handle = comfyPage.page.locator('.side-bar-panel + [role="separator"]')
  await expect(handle).toBeVisible()
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('Sidebar resize handle has no bounding box')

  const titleY = handleBox.y + handleBox.height / 2
  const nodeId = await placeNodeAt(
    comfyPage,
    { x: handleBox.x + handleBox.width + NODE_GAP_PX, y: titleY },
    'titleLeft'
  )
  const before = await nodePos(comfyPage, nodeId)

  const { mouse } = comfyPage.page
  const startX = handleBox.x + handleBox.width / 2 + grabOffset
  if (grabOffset > 0) {
    await expectNodeUnder(comfyPage, nodeId, { x: startX, y: titleY })
  }
  await mouse.move(startX, titleY)
  await mouse.down()
  await mouse.move(startX + DRAG_DISTANCE_PX, titleY, { steps: 20 })
  await mouse.up()
  await comfyPage.nextFrame()

  await expect
    .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialWidth + DRAG_DISTANCE_PX / 2)
  expect(await nodePos(comfyPage, nodeId)).toEqual(before)
}

/** Asserts a bottom panel resize grabbed just off the handle grows it without dragging the node under it. */
export async function expectBottomPanelResizeLeavesNode(comfyPage: ComfyPage) {
  const { bottomPanel } = comfyPage
  await comfyPage.toast.closeToasts()
  await bottomPanel.toggleButton.click()
  await expect(bottomPanel.resizeHandle).toBeVisible()
  const initialHeight = (await bottomPanel.root.boundingBox())?.height ?? 0

  const handleBox = await bottomPanel.resizeHandle.boundingBox()
  if (!handleBox) {
    throw new Error('Bottom panel resize handle has no bounding box')
  }
  const startX = handleBox.x + handleBox.width / 2
  const startY = handleBox.y + handleBox.height / 2 - GRAB_OFFSET_PX
  const nodeId = await placeNodeAt(
    comfyPage,
    { x: startX, y: handleBox.y },
    'center'
  )
  await expectNodeUnder(comfyPage, nodeId, { x: startX, y: startY })
  const before = await nodePos(comfyPage, nodeId)

  const { mouse } = comfyPage.page
  await mouse.move(startX, startY)
  await mouse.down()
  await mouse.move(startX, startY - BOTTOM_PANEL_DRAG_PX, { steps: 20 })
  await mouse.up()
  await comfyPage.nextFrame()

  await expect
    .poll(async () => (await bottomPanel.root.boundingBox())?.height ?? 0)
    .toBeGreaterThan(initialHeight + BOTTOM_PANEL_DRAG_PX / 2)
  expect(await nodePos(comfyPage, nodeId)).toEqual(before)
}
