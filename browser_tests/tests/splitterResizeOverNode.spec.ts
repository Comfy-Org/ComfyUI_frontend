import { expect } from '@playwright/test'

import type { NodeId } from '@/types/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const NODE_GAP_PX = 1
const GRAB_OFFSET_PX = 4
const COARSE_GRAB_OFFSET_PX = 10
const DRAG_DISTANCE_PX = 300
const BOTTOM_PANEL_DRAG_PX = 100

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
      const [graphX, graphY] = canvas.ds.convertOffsetToCanvas([
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

async function nodePos(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)
    return [node.pos[0], node.pos[1]]
  }, nodeId)
}

async function expectSidebarResizeLeavesNode(
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

for (const vueNodes of [false, true]) {
  test.describe(
    `Splitter resize over a node (${vueNodes ? 'Vue' : 'classic'} nodes)`,
    { tag: vueNodes ? ['@vue-nodes', '@canvas'] : ['@canvas'] },
    () => {
      test.use({
        initialSettings: {
          'Comfy.NodeLibrary.NewDesign': false,
          'Comfy.VueNodes.Enabled': vueNodes
        }
      })

      for (const { name, grabOffset } of [
        { name: 'grabbed on the handle', grabOffset: 0 },
        { name: 'grabbed over an adjacent node', grabOffset: GRAB_OFFSET_PX }
      ]) {
        test(`a sidebar resize ${name} does not drag the node`, async ({
          comfyPage
        }) => {
          await expectSidebarResizeLeavesNode(comfyPage, grabOffset)
        })
      }

      test('a bottom panel resize grabbed over an adjacent node does not drag the node', async ({
        comfyPage
      }) => {
        const { bottomPanel } = comfyPage
        await comfyPage.toast.closeToasts()
        await bottomPanel.toggleButton.click()
        await expect(bottomPanel.resizeHandle).toBeVisible()
        const initialHeight =
          (await bottomPanel.root.boundingBox())?.height ?? 0

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
      })

      test.describe('with a coarse pointer', () => {
        test.use({ hasTouch: true })

        test('a sidebar resize grabbed over an adjacent node does not drag the node', async ({
          comfyPage
        }) => {
          await expectSidebarResizeLeavesNode(comfyPage, COARSE_GRAB_OFFSET_PX)
        })
      })
    }
  )
}
