import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { PropertiesPanelHelper } from './PropertiesPanelHelper'

test.describe('Properties panel - Info tab', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await expect(comfyPage.actionbar.propertiesButton).toBeVisible()
    await comfyPage.actionbar.propertiesButton.click()
    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await panel.switchToTab('Info')
  })

  test('should show node help content', async () => {
    await expect(panel.contentArea).toBeVisible()
    await expect(
      panel.contentArea.getByRole('heading', { name: 'Inputs' })
    ).toBeVisible()
  })
})
