import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Copy and paste after selecting text outside the canvas',
  { tag: ['@canvas', '@node'] },
  () => {
    test('a node clicked on the classic canvas copies and pastes while topbar text is selected', async ({
      comfyPage
    }) => {
      const before = await comfyPage.nodeOps.getGraphNodesCount()
      const [node] = await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')

      await comfyPage.menu.topbar
        .getWorkflowTabLabel('Unsaved Workflow')
        .selectText()
      await node.click('title')
      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(before + 1)
    })
  }
)
