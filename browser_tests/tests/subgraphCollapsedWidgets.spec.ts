import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { getPromotedWidgetCount } from '../helpers/promotedWidgets'

/**
 * Navigate out of the current subgraph to its parent graph.
 */
async function exitSubgraphToParent(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.page.evaluate(() => {
    const canvas = window.app!.canvas
    if (!canvas.graph) return
    canvas.setGraph(canvas.graph.rootGraph)
  })
  await comfyPage.nextFrame()
}

test.describe(
  'Promoted widgets survive inner node collapse',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('DOM widgets stay visible on host when inner node is collapsed', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')

      // Convert a CLIPTextEncode (has DOM text widget) to a subgraph
      const clipNode = await comfyPage.nodeOps.getNodeRefById('6')
      await clipNode.click('title')
      const subgraphNode = await clipNode.convertToSubgraph()
      await comfyPage.nextFrame()

      const nodeId = String(subgraphNode.id)
      const widgetCountBefore = await getPromotedWidgetCount(comfyPage, nodeId)
      expect(widgetCountBefore).toBeGreaterThan(0)

      // Navigate into the subgraph and collapse the inner node
      await subgraphNode.navigateIntoSubgraph()
      await comfyPage.nextFrame()

      // Collapse all inner nodes via JS (they're inside the subgraph)
      await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        for (const node of graph._nodes) {
          if (!node.collapsed) {
            node.flags.collapsed = true
          }
        }
        graph._version++
      })
      await comfyPage.nextFrame()

      // Navigate back to parent
      await exitSubgraphToParent(comfyPage)
      await comfyPage.nextFrame()

      // Promoted widgets should still be present on the host
      const widgetCountAfter = await getPromotedWidgetCount(comfyPage, nodeId)
      expect(widgetCountAfter).toBe(widgetCountBefore)

      // DOM widget overlays should be visible on the host node
      // (v-show bound to widgetState.visible in DomWidget.vue)
      await expect
        .poll(() =>
          comfyPage.page.evaluate((id) => {
            const node = window.app!.canvas.graph!.getNodeById(Number(id))
            if (!node?.widgets) return 0
            return node.widgets.filter((w) => {
              const element = (w as { element?: HTMLElement }).element
              if (!(element instanceof HTMLElement)) return false
              const style = window.getComputedStyle(element)
              return (
                element.isConnected &&
                style.display !== 'none' &&
                style.visibility !== 'hidden'
              )
            }).length
          }, nodeId)
        )
        .toBeGreaterThan(0)
    })
  }
)
