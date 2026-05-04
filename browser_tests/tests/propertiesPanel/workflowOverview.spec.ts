import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Workflow Overview', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
  })

  test('should show "Workflow Overview" title when nothing is selected', async () => {
    await expect(panel.panelTitle).toContainText('Workflow Overview')
  })

  test('should show Parameters, Nodes, and Settings tabs', async () => {
    await expect(panel.getTab('Parameters')).toBeVisible()
    await expect(panel.getTab('Nodes')).toBeVisible()
    await expect(panel.getTab('Settings')).toBeVisible()
  })

  test('should not show Info tab when nothing is selected', async () => {
    await expect(panel.getTab('Info')).toBeHidden()
  })

  test('should switch to Nodes tab and list all workflow nodes', async ({
    comfyPage
  }) => {
    await panel.switchToTab('Nodes')
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBeGreaterThan(0)
    await expect(panel.contentArea.locator('text=KSampler')).toBeVisible()
  })

  test('should filter nodes by search in Nodes tab', async () => {
    await panel.switchToTab('Nodes')
    await panel.searchWidgets('KSampler')
    await expect(panel.contentArea.getByText('KSampler').first()).toBeVisible()
  })

  test('should switch to Settings tab and show global settings', async () => {
    await panel.switchToTab('Settings')
    await expect(panel.viewAllSettingsButton).toBeVisible()
  })

  test('should show "View all settings" button', async () => {
    await panel.switchToTab('Settings')
    await expect(panel.viewAllSettingsButton).toBeVisible()
  })

  test('should show Nodes section with toggles', async () => {
    await panel.switchToTab('Settings')
    await expect(
      panel.contentArea.getByRole('button', { name: 'NODES' })
    ).toBeVisible()
  })

  test('should show Canvas section with grid settings', async () => {
    await panel.switchToTab('Settings')
    await expect(panel.contentArea.getByText('Canvas')).toBeVisible()
  })

  test('should show Connection Links section', async () => {
    await panel.switchToTab('Settings')
    await expect(panel.contentArea.getByText('Connection Links')).toBeVisible()
  })
})
