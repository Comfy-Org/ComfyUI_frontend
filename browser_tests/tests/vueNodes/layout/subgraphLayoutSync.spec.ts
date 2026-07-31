import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.describe('Subgraph layout sync', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    await comfyPage.vueNodes.enterSubgraph('2')
    await expect(comfyPage.vueNodes.nodes).toHaveCount(2)
  })

  test('extension resize updates a Vue node after entering a subgraph', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node).toBeVisible()

    const modelWidth = await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.canvas.graph!.getNodeById(nodeId)!
      node.setSize([360, 200])
      return node.size[0]
    }, toNodeId('1'))

    expect(modelWidth).toBe(360)
    await expect
      .poll(
        () =>
          node.evaluate((element) =>
            element instanceof HTMLElement ? element.offsetWidth : 0
          ),
        { message: 'extension resize updates the rendered node width' }
      )
      .toBe(360)
  })
})
