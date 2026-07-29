import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { toRerouteId } from '@/types/rerouteId'

test.describe('Native reroute geometry', { tag: '@vue-nodes' }, () => {
  test('survives subgraph navigation', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(
      'reroute/single-native-reroute-default-workflow'
    )
    await comfyPage.canvasOps.expectRootReroutePositions({
      [toRerouteId(1)]: { x: 372.67, y: 415.33 }
    })

    const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
    await ksampler.click('title')
    const subgraphNode = await ksampler.convertToSubgraph()

    await comfyPage.vueNodes.enterSubgraph(subgraphNode.id)
    await comfyPage.subgraph.exitViaBreadcrumb()

    await comfyPage.canvasOps.expectRootReroutePositions({
      [toRerouteId(1)]: { x: 372.67, y: 415.33 }
    })
  })
})
