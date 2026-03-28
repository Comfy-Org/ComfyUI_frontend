import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { SubgraphHelper } from '../fixtures/helpers/SubgraphHelper'
import { TestIds } from '../fixtures/selectors'

/**
 * Regression test for legacy-prefixed proxyWidget normalization.
 *
 * Older serialized workflows stored proxyWidget entries with prefixed widget
 * names like "6: 3: string_a" instead of plain "string_a". This caused
 * resolution failures during configure, resulting in missing promoted widgets.
 *
 * The fixture contains an outer SubgraphNode (id 5) whose proxyWidgets array
 * has a legacy-prefixed entry: ["6", "6: 3: string_a"]. After normalization
 * the promoted widget should render with the clean name "string_a".
 *
 * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10573
 */
test.describe(
  'Legacy prefixed proxyWidget normalization',
  { tag: ['@subgraph', '@widget'] },
  () => {
    const WORKFLOW = 'subgraphs/nested-subgraph-legacy-prefixed-proxy-widgets'

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Loads without console warnings about failed widget resolution', async ({
      comfyPage
    }) => {
      const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
        comfyPage.page
      )

      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      expect(warnings).toEqual([])
      dispose()
    })

    test('Promoted widget renders with normalized name, not legacy prefix', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('5')
      await expect(outerNode).toBeVisible()

      // The promoted widget should render with the clean name "string_a",
      // not the legacy-prefixed "6: 3: string_a".
      const promotedWidget = outerNode
        .getByLabel('string_a', { exact: true })
        .first()
      await expect(promotedWidget).toBeVisible()
    })

    test('No legacy-prefixed or disconnected widgets remain on the node', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('5')
      await expect(outerNode).toBeVisible()

      // Both widget rows should be valid "string_a" widgets — no stale
      // "Disconnected" placeholders from unresolved legacy entries.
      const widgetRows = outerNode.getByTestId(TestIds.widgets.widget)
      await expect(widgetRows).toHaveCount(2)

      for (const row of await widgetRows.all()) {
        await expect(row.getByLabel('string_a', { exact: true })).toBeVisible()
      }
    })

    test('Promoted widget value is editable as a text input', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('5')
      const textarea = outerNode
        .getByRole('textbox', { name: 'string_a' })
        .first()
      await expect(textarea).toBeVisible()
    })
  }
)
