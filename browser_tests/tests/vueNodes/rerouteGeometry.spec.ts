import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'
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
    await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
    await comfyPage.vueNodes.selectNode(String(ksampler.id))
    await expect
      .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
      .toContain(toNodeId('3'))
    const subgraphNode = await ksampler.convertToSubgraph()

    await comfyPage.vueNodes.enterSubgraph(subgraphNode.id)
    await comfyPage.subgraph.exitViaBreadcrumb()

    await comfyPage.canvasOps.expectRootReroutePositions({
      [toRerouteId(1)]: { x: 372.67, y: 415.33 }
    })
  })
})
