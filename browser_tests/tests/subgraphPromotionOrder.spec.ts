import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'
import { getPromotedWidgetNames } from '../helpers/promotedWidgets'

test.describe(
  'Subgraph promoted widget ordering',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('demote then re-promote preserves widget order', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')

      // Create a subgraph from the KSampler node which has multiple
      // auto-promoted widgets (seed, steps, cfg, etc.)
      await comfyPage.vueNodes.waitForNodes()

      // Select KSampler and convert to subgraph via evaluate
      // (LG nodeRef helpers don't work reliably in Vue nodes mode)
      const nodeId = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const ksampler = graph._nodes.find((n) => n.type === 'KSampler')
        if (!ksampler) throw new Error('KSampler not found')

        window.app!.canvas.selectNode(ksampler)
        const result = graph.convertToSubgraph(new Set([ksampler]))
        if (!result) throw new Error('convertToSubgraph failed')
        return String(result.node.id)
      })
      await comfyPage.nextFrame()
      await comfyPage.vueNodes.waitForNodes()

      // Verify promoted widgets render in the Vue node body
      const subgraphVueNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(subgraphVueNode).toBeVisible()

      const widgetsContainer = subgraphVueNode.getByTestId(
        TestIds.widgets.container
      )
      await expect(widgetsContainer).toBeVisible()

      // Get the initial promoted widget order
      const initialOrder = await getPromotedWidgetNames(comfyPage, nodeId)
      expect(initialOrder.length).toBeGreaterThanOrEqual(2)

      // Demote then re-promote the first widget via the promotion store.
      // Pinia store access pattern: see getPiniaStoreInBrowser in
      // browser_tests/helpers/promotedWidgets.ts
      const finalOrder = await comfyPage.page.evaluate(
        ([id, widgetName]) => {
          const el = document.getElementById('vue-app') as never as {
            __vue_app__: {
              config: {
                globalProperties: {
                  $pinia: {
                    _s: Map<
                      string,
                      Record<string, (...args: unknown[]) => unknown>
                    >
                  }
                }
              }
            }
          }
          const store =
            el.__vue_app__.config.globalProperties.$pinia._s.get('promotion')
          if (!store) throw new Error('promotionStore not found')

          const node = window.app!.canvas.graph!.getNodeById(id)
          if (!node) throw new Error(`Node "${id}" not found`)
          const graphId = (node as typeof node & { rootGraph?: { id: string } })
            .rootGraph?.id

          const entries = store.getPromotions(graphId, node.id) as {
            sourceWidgetName: string
          }[]
          const target = entries.find((e) => e.sourceWidgetName === widgetName)
          if (!target) throw new Error(`Widget "${widgetName}" not found`)

          store.demote(graphId, node.id, target)
          node.computeSize(node.size)

          store.promote(graphId, node.id, target)
          node.computeSize(node.size)

          return (node.widgets ?? []).map((w: { name: string }) => w.name)
        },
        [nodeId, initialOrder[0]]
      )

      expect(finalOrder).toEqual(initialOrder)
    })
  }
)
