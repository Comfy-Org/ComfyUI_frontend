import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel global settings', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(comfyPage.propertiesPanel.root).toBeVisible()
    await comfyPage.propertiesPanel.clickTab('Global Settings')
  })

  test.describe('Global settings sections', () => {
    test('displays Nodes section', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.root.getByText('Nodes')).toBeVisible()
    })

    test('displays Canvas section', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await expect(propertiesPanel.root.getByText('Canvas')).toBeVisible()
    })

    test('displays Connection Links section', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await expect(
        propertiesPanel.root.getByText('Connection Links')
      ).toBeVisible()
    })

    test('has View all settings button', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      const viewAllButton = propertiesPanel.root.getByRole('button', {
        name: /View all settings/i
      })
      await expect(viewAllButton).toBeVisible()
    })
  })

  test.describe('Nodes section settings', () => {
    test('can toggle Show advanced parameters', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      const toggle = propertiesPanel.root
        .locator('label', { hasText: 'Show advanced parameters' })
        .locator('button[role="switch"]')

      await expect(toggle).toBeVisible()

      const initialState = await toggle.getAttribute('aria-checked')
      await toggle.click()

      const newState = await toggle.getAttribute('aria-checked')
      expect(newState).not.toBe(initialState)
    })

    test('can toggle Nodes 2.0 setting', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      const toggle = propertiesPanel.root
        .locator('label', { hasText: 'Nodes 2.0' })
        .locator('button[role="switch"]')

      await expect(toggle).toBeVisible()
    })
  })

  test.describe('Canvas section settings', () => {
    test('can adjust grid spacing', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      const gridSpacingLabel = propertiesPanel.root.getByText('Grid Spacing')
      await expect(gridSpacingLabel).toBeVisible()
    })

    test('can toggle Snap nodes to grid', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      const toggle = propertiesPanel.root
        .locator('label', { hasText: 'Snap nodes to grid' })
        .locator('button[role="switch"]')

      await expect(toggle).toBeVisible()
    })
  })

  test.describe('Connection Links section settings', () => {
    test('has link shape selector', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      const linkShapeLabel = propertiesPanel.root.getByText('Link Shape')
      await expect(linkShapeLabel).toBeVisible()
    })

    test('can toggle Show connected links', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      const toggle = propertiesPanel.root
        .locator('label', { hasText: 'Show connected links' })
        .locator('button[role="switch"]')

      await expect(toggle).toBeVisible()
    })
  })

  test.describe('View all settings navigation', () => {
    test('opens full settings dialog when clicking View all settings', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      const viewAllButton = propertiesPanel.root.getByRole('button', {
        name: /View all settings/i
      })

      await viewAllButton.click()

      await expect(comfyPage.settingDialog.root).toBeVisible()
    })
  })
})
