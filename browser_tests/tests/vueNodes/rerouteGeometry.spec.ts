import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { toRerouteId } from '@/types/rerouteId'

test.describe('Native reroute geometry', { tag: '@vue-nodes' }, () => {
  test(
    'moves geometry received before graph materialization',
    { tag: '@canvas' },
    async ({ comfyPage }) => {
      const GRAPH_ID = 'dec788c2-9829-4a5d-a1ee-d6f0a678b42a'
      const REROUTE_ID = toRerouteId(1)
      const remotePosition = { x: 500, y: 300 }
      await comfyPage.page.addScriptTag({
        type: 'module',
        content: `
          import { layoutStore } from '/src/renderer/core/layout/store/layoutStore.ts'
          import { LayoutSource } from '/src/renderer/core/layout/types.ts'

          layoutStore.applyOperation({
            type: 'createReroute',
            entity: 'reroute',
            graphId: '${GRAPH_ID}',
            rerouteId: ${REROUTE_ID},
            position: ${JSON.stringify(remotePosition)},
            registrationId: 'remote-peer',
            timestamp: Date.now(),
            source: LayoutSource.External,
            actor: 'remote-peer'
          })
          document.documentElement.dataset.remoteRerouteReady = 'true'
        `
      })
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => document.documentElement.dataset.remoteRerouteReady
          )
        )
        .toBe('true')

      await comfyPage.workflow.loadWorkflow(
        'reroute/single-native-reroute-default-workflow'
      )
      await comfyPage.canvasOps.resetView()
      await comfyPage.canvasOps.expectRootReroutePositions({
        [REROUTE_ID]: remotePosition
      })

      const [x, y] = await comfyPage.page.evaluate(
        (position) =>
          window.app!.canvasPosToClientPos([position.x, position.y]),
        remotePosition
      )
      await comfyPage.page.mouse.move(x, y)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(x + 100, y, { steps: 10 })
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await comfyPage.canvasOps.expectRootReroutePositions({
        [REROUTE_ID]: { x: remotePosition.x + 100, y: remotePosition.y }
      })
    }
  )

  test('survives subgraph navigation', async ({ comfyPage }) => {
    const REROUTE_ID = toRerouteId(1)
    await comfyPage.workflow.loadWorkflow(
      'reroute/single-native-reroute-default-workflow'
    )
    await comfyPage.canvasOps.expectRootReroutePositions({
      [REROUTE_ID]: { x: 372.67, y: 415.33 }
    })

    const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
    await ksampler.click('title')
    const subgraphNode = await ksampler.convertToSubgraph()

    await comfyPage.vueNodes.enterSubgraph(subgraphNode.id)
    await comfyPage.subgraph.exitViaBreadcrumb()

    await comfyPage.canvasOps.expectRootReroutePositions({
      [REROUTE_ID]: { x: 372.67, y: 415.33 }
    })
  })
})
