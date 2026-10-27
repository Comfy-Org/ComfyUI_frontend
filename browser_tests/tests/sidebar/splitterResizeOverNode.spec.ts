import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  COARSE_GRAB_OFFSET_PX,
  GRAB_OFFSET_PX,
  expectBottomPanelResizeLeavesNode,
  expectSidebarResizeLeavesNode
} from '@e2e/fixtures/helpers/SplitterResizeHelper'

for (const vueNodes of [false, true]) {
  test.describe(
    `Splitter resize over a node (${vueNodes ? 'Vue' : 'classic'} nodes)`,
    { tag: vueNodes ? ['@vue-nodes', '@canvas'] : ['@canvas'] },
    () => {
      test.use({
        initialSettings: { 'Comfy.NodeLibrary.NewDesign': false }
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
        await expectBottomPanelResizeLeavesNode(comfyPage)
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
