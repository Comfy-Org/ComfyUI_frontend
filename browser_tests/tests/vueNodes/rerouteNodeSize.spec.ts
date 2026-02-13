import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../fixtures/ComfyPage'

test.describe('Vue Reroute Node Size', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.workflow.loadWorkflow('links/single_connected_reroute_node')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'reroute node visual appearance',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-reroute-node-compact.png'
      )
    }
  )

  test('reroute node renders compact', async ({ comfyPage }) => {
    const rerouteNodeId = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const rerouteNode = graph.nodes.find((n) => n.type === 'Reroute')
      return rerouteNode ? String(rerouteNode.id) : null
    })

    expect(rerouteNodeId).not.toBeNull()

    const rerouteEl = comfyPage.vueNodes.getNodeLocator(rerouteNodeId!)
    const box = await rerouteEl.boundingBox()

    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThan(100)
    expect(box!.width).toBeGreaterThan(10)
    expect(box!.height).toBeLessThan(40)
    expect(box!.height).toBeGreaterThan(5)
  })

  test('reroute node is smaller than regular nodes', async ({ comfyPage }) => {
    const nodeIds = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const reroute = graph.nodes.find((n) => n.type === 'Reroute')
      const regular = graph.nodes.find((n) => n.type !== 'Reroute')
      return {
        rerouteId: reroute ? String(reroute.id) : null,
        regularId: regular ? String(regular.id) : null
      }
    })

    expect(nodeIds.rerouteId).not.toBeNull()
    expect(nodeIds.regularId).not.toBeNull()

    const rerouteBox = await comfyPage.vueNodes
      .getNodeLocator(nodeIds.rerouteId!)
      .boundingBox()
    const regularBox = await comfyPage.vueNodes
      .getNodeLocator(nodeIds.regularId!)
      .boundingBox()

    expect(rerouteBox).not.toBeNull()
    expect(regularBox).not.toBeNull()
    expect(rerouteBox!.width).toBeLessThan(regularBox!.width)
    expect(rerouteBox!.height).toBeLessThan(regularBox!.height)
  })

  test('reroute node does not have a resize handle', async ({ comfyPage }) => {
    const rerouteNodeId = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const rerouteNode = graph.nodes.find((n) => n.type === 'Reroute')
      return rerouteNode ? String(rerouteNode.id) : null
    })

    expect(rerouteNodeId).not.toBeNull()

    const rerouteEl = comfyPage.vueNodes.getNodeLocator(rerouteNodeId!)
    const resizeHandle = rerouteEl.locator('[role="button"][aria-label]')
    await expect(resizeHandle).toHaveCount(0)
  })

  test('reroute node bypasses min-width constraint', async ({ comfyPage }) => {
    const rerouteNodeId = await comfyPage.page.evaluate(() => {
      const graph = window.app!.graph!
      const rerouteNode = graph.nodes.find((n) => n.type === 'Reroute')
      return rerouteNode ? String(rerouteNode.id) : null
    })

    expect(rerouteNodeId).not.toBeNull()

    const rerouteEl = comfyPage.vueNodes.getNodeLocator(rerouteNodeId!)
    const classes = await rerouteEl.getAttribute('class')
    expect(classes).not.toContain('min-w-')
    expect(classes).not.toContain('min-h-')
  })
})
