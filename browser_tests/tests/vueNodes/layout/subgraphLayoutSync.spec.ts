import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test(
  'nodes keep following graph mutations across every graph transition',
  { tag: '@vue-nodes' },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
    await comfyPage.vueNodes.waitForNodes()

    const [rootNodeId] = await comfyPage.vueNodes.getNodeIds()
    await comfyPage.vueNodes.expectGraphSizeGrowth(
      rootNodeId,
      'at the root graph'
    )

    await comfyPage.vueNodes.enterSubgraph('2')
    const [interiorNodeId] = await comfyPage.vueNodes.getNodeIds()
    await comfyPage.vueNodes.expectGraphSizeGrowth(
      interiorNodeId,
      'inside the subgraph'
    )

    await comfyPage.subgraph.exitViaBreadcrumb()
    await comfyPage.vueNodes.waitForNodes()
    await comfyPage.vueNodes.expectGraphSizeGrowth(
      rootNodeId,
      'back at the root graph after leaving the subgraph'
    )

    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.vueNodes.waitForNodes()
    const [reloadedNodeId] = await comfyPage.vueNodes.getNodeIds()
    await comfyPage.vueNodes.expectGraphSizeGrowth(
      reloadedNodeId,
      'after loading a second workflow'
    )
  }
)
