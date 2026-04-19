import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const DOM_WIDGET_SELECTOR = '.comfy-multiline-input'
const VISIBLE_DOM_WIDGET_SELECTOR = `${DOM_WIDGET_SELECTOR}:visible`

async function toggleSubgraphCollapse(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<void> {
  await comfyPage.page.evaluate((id) => {
    const node = window.app!.graph!.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)
    node.collapse()
  }, nodeId)
  await comfyPage.nextFrame()
}

test.describe(
  'Subgraph collapse hides DOM widgets',
  { tag: ['@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    })

    test('promoted DOM widget is hidden when SubgraphNode collapses and restored on expand', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const visibleWidgets = comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)
      await expect(
        visibleWidgets,
        'Promoted text widget should be visible before collapse'
      ).toHaveCount(1)

      await toggleSubgraphCollapse(comfyPage, '11')

      await expect(visibleWidgets).toHaveCount(0)

      await toggleSubgraphCollapse(comfyPage, '11')

      await expect(visibleWidgets).toHaveCount(1)
    })

    test('all promoted DOM widgets are hidden when SubgraphNode collapses', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-widgets'
      )

      const visibleWidgets = comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)
      await expect(
        visibleWidgets,
        'Both promoted text widgets should be visible before collapse'
      ).toHaveCount(2)

      await toggleSubgraphCollapse(comfyPage, '11')

      await expect(visibleWidgets).toHaveCount(0)
    })

    test('DOM widgets stay hidden after entering and exiting a collapsed subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      await toggleSubgraphCollapse(comfyPage, '11')
      await expect(
        comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)
      ).toHaveCount(0)

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph!.nodes.find(
          (n) => typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
        )
        if (!node || !('subgraph' in node))
          throw new Error('SubgraphNode not found')
        window.app!.canvas.openSubgraph(node.subgraph, node)
      })
      await comfyPage.nextFrame()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect(
        comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)
      ).toHaveCount(0)
    })
  }
)
