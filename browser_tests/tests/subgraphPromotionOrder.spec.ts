import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
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
      const ksampler = comfyPage.vueNodes.getNodeByTitle('KSampler')
      await comfyPage.vueNodes.waitForNodes()
      await expect(ksampler).toBeVisible()

      // Select and convert to subgraph
      const ksamplerRef = await comfyPage.nodeOps.getNodeRefById('3')
      await ksamplerRef.click('title')
      const subgraphNode = await ksamplerRef.convertToSubgraph()
      await comfyPage.nextFrame()
      await comfyPage.vueNodes.waitForNodes()

      const nodeId = String(subgraphNode.id)

      // Verify promoted widgets render in the Vue node body
      const subgraphVueNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(subgraphVueNode).toBeVisible()

      const nodeBody = subgraphVueNode.locator(
        `[data-testid="node-body-${nodeId}"]`
      )
      const widgetElements = nodeBody.locator('.lg-node-widgets > div')
      await expect(widgetElements.first()).toBeVisible()

      // Get the initial promoted widget order
      const initialOrder = await getPromotedWidgetNames(comfyPage, nodeId)
      expect(initialOrder.length).toBeGreaterThanOrEqual(2)

      // Verify widget count in the DOM matches
      const domWidgetCount = await widgetElements.count()
      expect(domWidgetCount).toBeGreaterThanOrEqual(initialOrder.length)

      // Demote then re-promote the first widget via the promotion store
      const finalOrder = await comfyPage.page.evaluate(
        ([id, widgetName]) => {
          const el = document.getElementById('vue-app') as HTMLElement & {
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
          const graphId = (node as { rootGraph?: { id: string } }).rootGraph?.id

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
