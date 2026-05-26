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

async function setVueMode(
  comfyPage: ComfyPage,
  enabled: boolean
): Promise<void> {
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', enabled)
  if (enabled) {
    await comfyPage.vueNodes.waitForNodes()
  }
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

    test('no ghost DOM widgets on collapsed subgraph after Vue-to-Legacy toggle', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const visibleWidgets = comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)
      await expect(visibleWidgets).toHaveCount(1)

      await toggleSubgraphCollapse(comfyPage, '11')
      await expect(visibleWidgets).toHaveCount(0)

      await setVueMode(comfyPage, true)
      await setVueMode(comfyPage, false)

      await expect(visibleWidgets).toHaveCount(0)
    })

    test('no ghost DOM widgets after repeated renderer toggles on collapsed subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      await toggleSubgraphCollapse(comfyPage, '11')
      const visibleWidgets = comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)

      for (let i = 0; i < 3; i++) {
        await setVueMode(comfyPage, true)
        await setVueMode(comfyPage, false)
      }

      await expect(visibleWidgets).toHaveCount(0)
    })

    test('widgets reappear after mode toggle then expand on collapsed subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      await toggleSubgraphCollapse(comfyPage, '11')

      await setVueMode(comfyPage, true)
      await setVueMode(comfyPage, false)

      await toggleSubgraphCollapse(comfyPage, '11')

      await expect(
        comfyPage.page.locator(VISIBLE_DOM_WIDGET_SELECTOR)
      ).toHaveCount(1)
    })
  }
)
