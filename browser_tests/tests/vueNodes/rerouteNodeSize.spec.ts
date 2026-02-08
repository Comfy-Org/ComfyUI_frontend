import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../fixtures/ComfyPage'

test.describe('Vue Reroute Node Size', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  })

  test('reroute node renders smaller than 225px minimum width', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('links/single_connected_reroute_node')
    await comfyPage.vueNodes.waitForNodes()

    const rerouteNodeId = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const rerouteNode = graph.nodes.find((n) => n.type === 'Reroute')
      return rerouteNode ? String(rerouteNode.id) : null
    })

    expect(rerouteNodeId).not.toBeNull()

    const rerouteEl = comfyPage.vueNodes.getNodeLocator(rerouteNodeId!)
    const box = await rerouteEl.boundingBox()

    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThan(150)
    expect(box!.width).toBeGreaterThan(30)
  })
})
