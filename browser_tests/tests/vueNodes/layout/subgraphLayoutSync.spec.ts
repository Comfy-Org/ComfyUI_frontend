import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'

/**
 * Deliberately an integration test, not a user-action test: the `setSize` call
 * below emulates how a legacy custom node mutates the graph directly, which is
 * the path under test. There is no click or keystroke equivalent for it.
 */
test(
  'extension resize updates an internal node after entering its subgraph',
  { tag: '@vue-nodes' },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    await comfyPage.vueNodes.enterSubgraph('2')

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await expect(node).toBeVisible()

    const initialBounds = await node.evaluate((element) => [
      element instanceof HTMLElement ? element.offsetWidth : 0,
      element instanceof HTMLElement ? element.offsetHeight : 0
    ])
    expect(initialBounds[0]).toBeGreaterThan(0)
    expect(initialBounds[1]).toBeGreaterThan(0)

    await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.canvas.graph!.getNodeById(nodeId)!
      node.setSize([node.size[0] + 90, node.size[1] + 100])
    }, toNodeId('1'))

    await expect
      .poll(
        async () => {
          return await node.evaluate((element) => [
            element instanceof HTMLElement ? element.offsetWidth : 0,
            element instanceof HTMLElement ? element.offsetHeight : 0
          ])
        },
        { message: 'extension resize updates the rendered node bounds' }
      )
      .toEqual([initialBounds[0] + 90, initialBounds[1] + 100])
  }
)
