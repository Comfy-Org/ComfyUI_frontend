import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { PropertiesPanelHelper } from './PropertiesPanelHelper'

test.describe('Properties panel - Open and close', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
  })

  test('should open via actionbar toggle button', async ({ comfyPage }) => {
    await expect(panel.root).not.toBeVisible()
    await expect(comfyPage.actionbar.propertiesButton).toBeVisible()
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
  })

  test('should close via panel close button', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
    await expect(panel.closeButton).toBeVisible()
    await panel.closeButton.click()
    await expect(panel.root).not.toBeVisible()
  })

  test('should close via close button after opening', async ({ comfyPage }) => {
    await expect(comfyPage.actionbar.propertiesButton).toBeVisible()
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
    await panel.close()
    await expect(panel.root).not.toBeVisible()
  })
})
