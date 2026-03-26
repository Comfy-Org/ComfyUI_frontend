import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph Promoted Widgets', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('promoted DOM widgets remain visible on host when inner node is collapsed', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    // Convert a node with a DOM widget (CLIPTextEncode) to a subgraph
    const clipNode = await comfyPage.nodeOps.getNodeRefById('6')
    const subgraphNode = await clipNode.convertToSubgraph()
    await comfyPage.nextFrame()

    // Identify the DOM widget (textarea)
    const widget = comfyPage.page
      .locator('textarea.comfy-multiline-input')
      .first()
    await expect(widget).toBeVisible()

    // Navigate into the subgraph and collapse the inner node
    await subgraphNode.navigateIntoSubgraph()
    await comfyPage.nextFrame()

    await comfyPage.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      for (const node of graph._nodes) {
        node.flags.collapsed = true
      }
      graph._version++
    })
    await comfyPage.nextFrame()

    // Navigate back to the parent graph
    await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      if (canvas.graph?.rootGraph) {
        canvas.setGraph(canvas.graph.rootGraph)
      }
    })
    await comfyPage.nextFrame()

    // Assert the widget is still visible on the host node despite the inner node being collapsed
    await expect(widget).toBeVisible()
    await expect(widget).toHaveScreenshot(
      'subgraph-promoted-widget-collapsed-inner.png'
    )
  })
})
