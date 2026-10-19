import { expect } from '@playwright/test'

import type { NodeId } from '@/types/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

// Inside the resize handle's 5px hit margin, over the node beside it.
const NODE_GAP_PX = 1
const GRAB_OFFSET_PX = 4
const DRAG_DISTANCE_PX = 300

async function placeNodeRightOfSidebar(comfyPage: ComfyPage) {
  const handle = comfyPage.page.locator('.side-bar-panel + [role="separator"]')
  await expect(handle).toBeVisible()
  const box = await handle.boundingBox()
  if (!box) throw new Error('Sidebar resize handle has no bounding box')

  const titleY = box.y + box.height / 2
  const nodeId = await comfyPage.page.evaluate(
    ({ x, y }) => {
      const canvas = window.app!.canvas
      const node = window.app!.graph.nodes[0]
      const rect = canvas.canvas.getBoundingClientRect()
      const [graphX, graphY] = canvas.ds.convertOffsetToCanvas([
        x - rect.left,
        y - rect.top
      ])
      node.pos = [graphX, graphY + window.LiteGraph!.NODE_TITLE_HEIGHT / 2]
      canvas.setDirty(true, true)
      return node.id
    },
    { x: box.x + box.width + NODE_GAP_PX, y: titleY }
  )
  await comfyPage.nextFrame()
  return { handleBox: box, nodeId, titleY }
}

async function nodePos(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)
    return [node.pos[0], node.pos[1]]
  }, nodeId)
}

for (const vueNodes of [false, true]) {
  test.describe(
    `Sidebar resize over a node (${vueNodes ? 'Vue' : 'classic'} nodes)`,
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
        test(`a resize ${name} does not drag the node`, async ({
          comfyPage
        }) => {
          await comfyPage.toast.closeToasts()
          await comfyPage.menu.nodeLibraryTab.open()
          const sidebar = comfyPage.menu.nodeLibraryTab.panel
          const initialWidth = (await sidebar.boundingBox())?.width ?? 0

          const { handleBox, nodeId, titleY } =
            await placeNodeRightOfSidebar(comfyPage)
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
        })
      }
    }
  )
}
