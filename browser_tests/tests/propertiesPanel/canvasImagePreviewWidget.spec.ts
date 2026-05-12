import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

/**
 * FE-563: the `$$canvas-image-preview` pseudo-widget is not user-facing and
 * must not appear in the right side panel. Filtered by `$$` prefix until
 * image-preview rendering in the panel is properly designed.
 *
 * Intentionally brittle: when the preview is given a real, user-facing name
 * in a future refactor, this test is expected to FAIL so the temporary
 * filter (and this test) get cleaned up at the right time.
 */
test.describe('Properties panel - canvas image preview widget', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
  })

  test('does not render the $$canvas-image-preview promoted widget on a subgraph node', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-preview-node'
    )

    await comfyPage.nodeOps.selectNodes(['New Subgraph'])
    await comfyPage.actionbar.propertiesButton.click()

    await expect(panel.panelTitle).toContainText('New Subgraph')

    const widgetItems = panel.contentArea.locator('.widget-item')
    await expect(
      widgetItems.filter({ hasText: 'filename_prefix' })
    ).toHaveCount(1)
    await expect(
      panel.contentArea.getByText('$$canvas-image-preview')
    ).toHaveCount(0)
    await expect(widgetItems).toHaveCount(1)
  })
})
