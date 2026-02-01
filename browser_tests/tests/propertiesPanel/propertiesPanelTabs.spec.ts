import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel tab navigation', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(comfyPage.propertiesPanel.root).toBeVisible()
  })

  test.describe('Tab switching', () => {
    test('switches between tabs in workflow overview mode', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()

      await propertiesPanel.clickTab('Nodes')
      await expect(propertiesPanel.root.getByText('KSampler')).toBeVisible()

      await propertiesPanel.clickTab('Global Settings')
      await expect(
        propertiesPanel.root.getByRole('button', { name: 'NODES' })
      ).toBeVisible()
      await expect(
        propertiesPanel.root.getByRole('button', { name: 'CANVAS' })
      ).toBeVisible()
    })

    test('switches between tabs in single node mode', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])

      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()
      await expect(propertiesPanel.getTab('Info')).toBeVisible()
      await expect(propertiesPanel.getTab('Settings')).toBeVisible()

      await propertiesPanel.clickTab('Info')
      await expect(propertiesPanel.root).toContainText('KSampler')

      await propertiesPanel.clickTab('Settings')
      await expect(
        propertiesPanel.root.getByText('Color').first()
      ).toBeVisible()

      await propertiesPanel.clickTab('Parameters')
      await expect(propertiesPanel.root.getByText('seed')).toBeVisible()
    })
  })

  test.describe('Tab availability based on selection', () => {
    test('shows different tabs based on selection state', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()
      await expect(propertiesPanel.getTab('Nodes')).toBeVisible()
      await expect(propertiesPanel.getTab('Global Settings')).toBeVisible()
      await expect(propertiesPanel.getTab('Info')).not.toBeVisible()

      await comfyPage.selectNodes(['KSampler'])
      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()
      await expect(propertiesPanel.getTab('Info')).toBeVisible()
      await expect(propertiesPanel.getTab('Settings')).toBeVisible()
      await expect(propertiesPanel.getTab('Nodes')).not.toBeVisible()

      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])
      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()
      await expect(propertiesPanel.getTab('Settings')).toBeVisible()
      await expect(propertiesPanel.getTab('Info')).not.toBeVisible()
      await expect(propertiesPanel.getTab('Nodes')).not.toBeVisible()
    })

    test('first tab updates for multiple selection', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])
      await expect(propertiesPanel.getTab('Parameters')).toBeVisible()

      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])
      const firstTab = propertiesPanel.tabList.locator('[role="tab"]').first()
      await expect(firstTab).toBeVisible()
    })
  })

  test.describe('Tab persistence', () => {
    test('remembers active tab when selection changes', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])
      await propertiesPanel.clickTab('Settings')

      await comfyPage.selectNodes(['VAE Decode'])

      await expect(propertiesPanel.getTab('Settings')).toBeVisible()
    })

    test('falls back to default tab when current tab not available', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])
      await propertiesPanel.clickTab('Info')

      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])

      await expect(propertiesPanel.getTab('Info')).not.toBeVisible()
      const firstTab = propertiesPanel.tabList.locator('[role="tab"]').first()
      await expect(firstTab).toHaveAttribute('aria-selected', 'true')
    })
  })
})
