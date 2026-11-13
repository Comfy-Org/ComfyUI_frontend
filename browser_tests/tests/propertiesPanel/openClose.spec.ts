import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanel } from '@e2e/fixtures/components/PropertiesPanel'

test.describe('Properties panel - Open and close', () => {
  let panel: PropertiesPanel

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanel(comfyPage.page)
  })

  test('should open via actionbar toggle button', async ({ comfyPage }) => {
    await expect(panel.root).toBeHidden()
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
  })

  test('should close via panel close button', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
    await panel.closeButton.click()
    await expect(panel.root).toBeHidden()
  })

  test('should close via close button after opening', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
    await panel.close()
    await expect(panel.root).toBeHidden()
  })
})
