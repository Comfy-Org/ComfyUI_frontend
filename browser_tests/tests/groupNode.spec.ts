import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Group nodes are a deprecated feature. Workflows that still contain group nodes
 * are auto-converted to subgraphs on load (with accepted lossiness).
 */
test.describe('Group node migration', { tag: '@node' }, () => {
  test('Auto-converts a loaded group node into a subgraph', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groupnodes/group_node_v1.3.3')

    const state = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      return {
        groupNodeInstances: graph.nodes.filter((n) =>
          String(n.type).startsWith('workflow>')
        ).length,
        subgraphCount: graph.subgraphs.size,
        hasGroupNodesExtra: !!graph.extra?.groupNodes
      }
    })

    expect(state.groupNodeInstances).toBe(0)
    expect(state.subgraphCount).toBe(1)
    expect(state.hasGroupNodesExtra).toBe(false)
  })

  test(
    'Loads a legacy ("/") separator group node without error and converts it',
    { tag: ['@vue-nodes'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('groupnodes/legacy_group_node')

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect(
        comfyPage.vueNodes.getNodeByTitle('New Subgraph')
      ).toBeVisible()

      await comfyPage.vueNodes.enterSubgraph()
      await expect(comfyPage.vueNodes.getNodeByTitle('')).toHaveCount(2)
    }
  )
})
