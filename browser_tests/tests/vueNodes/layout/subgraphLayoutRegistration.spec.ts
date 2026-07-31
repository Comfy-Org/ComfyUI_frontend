import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

test.describe('Subgraph layout registration', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    await comfyPage.vueNodes.enterSubgraph('2')
    await comfyPage.vueNodes.waitForNodes(2)
  })

  test('same local node id keeps its subgraph position', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('2')
    await expect(node).toBeVisible()
    const position = await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.canvas.graph!.getNodeById(nodeId)!
      const element = document.querySelector<HTMLElement>('[data-node-id="2"]')!
      return {
        expected: `translate(${node.pos[0]}px, ${node.pos[1] - 30}px)`,
        rendered: element.style.transform
      }
    }, toNodeId('2'))

    expect(position.rendered).toBe(position.expected)
  })

  test('node keeps receiving layout changes after navigation', async ({
    comfyPage
  }) => {
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
