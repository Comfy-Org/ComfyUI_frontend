import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

const WORKFLOW = 'subgraphs/nested-subgraph-stale-proxy-widgets'

/**
 * Regression test for nested subgraph packing leaving stale proxyWidgets
 * on the outer SubgraphNode.
 *
 * When two CLIPTextEncode nodes (ids 6, 7) inside the outer subgraph are
 * packed into a nested subgraph (node 11), the outer SubgraphNode (id 10)
 * must drop the now-stale ["7","text"] and ["6","text"] proxy entries.
 * Only ["3","seed"] (KSampler) should remain.
 *
 * Stale entries render as "Disconnected" placeholder widgets (type "button").
 *
 * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10390
 */
test.describe(
  'Nested subgraph stale proxyWidgets',
  { tag: ['@subgraph', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Outer subgraph node has no stale proxyWidgets after nested packing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('10')
      await expect(outerNode).toBeVisible()

      const widgets = outerNode.getByTestId(TestIds.widgets.widget)

      // Only the KSampler seed widget should be present — no stale
      // "Disconnected" placeholders from the packed CLIPTextEncode nodes.
      await expect(widgets).toHaveCount(1)
      await expect(widgets.first()).toBeVisible()

      // Verify the seed widget is present via its label
      const seedWidget = outerNode.getByLabel('seed', { exact: true })
      await expect(seedWidget).toBeVisible()
    })
  }
)
