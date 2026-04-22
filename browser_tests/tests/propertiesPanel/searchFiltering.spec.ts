import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Search filtering', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.actionbar.propertiesButton.click()
    await comfyPage.nodeOps.selectNodes([
      'KSampler',
      'CLIP Text Encode (Prompt)'
    ])
  })

  test('should filter nodes by search query', async () => {
    await panel.searchWidgets('seed')
    await expect(panel.root.getByText('KSampler')).toHaveCount(1)
    await expect(panel.root.getByText('CLIP Text Encode (Prompt)')).toHaveCount(
      0
    )
  })

  test('should restore all nodes when search is cleared', async () => {
    await panel.searchWidgets('seed')
    await panel.clearSearch()
    await expect(panel.root.getByText('KSampler')).toHaveCount(1)
    await expect(panel.root.getByText('CLIP Text Encode (Prompt)')).toHaveCount(
      2
    )
  })

  test('should show empty state for no matches', async () => {
    await panel.searchWidgets('nonexistent_widget_xyz')
    await expect(
      panel.contentArea.getByText(/no .* match|no results|no items/i)
    ).toBeVisible()
  })
})
