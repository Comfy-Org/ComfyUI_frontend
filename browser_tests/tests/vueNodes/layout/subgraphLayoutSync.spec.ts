import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.describe('Subgraph layout sync', { tag: '@vue-nodes' }, () => {
  test('node keeps receiving layout changes after navigation', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    await comfyPage.vueNodes.enterSubgraph('2')
    await comfyPage.vueNodes.waitForNodes(2)

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node).toBeVisible()

    await comfyPage.page.evaluate((nodeId) => {
      window.app!.canvas.graph!.getNodeById(nodeId)!.setSize([360, 200])
    }, toNodeId('1'))

    await expect
      .poll(() =>
        node.evaluate((element) =>
          element.style.getPropertyValue('--node-width')
        )
      )
      .toBe('360px')
  })
})
