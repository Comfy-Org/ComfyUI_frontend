import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel search functionality', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(comfyPage.propertiesPanel.root).toBeVisible()
  })

  test.describe('Search with multiple nodes selected', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.selectNodes(['KSampler', 'VAE Decode'])
    })

    test('filters widgets by search query', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await propertiesPanel.searchBox.fill('seed')

      await expect(propertiesPanel.root.getByText('KSampler')).toBeVisible()
      await expect(
        propertiesPanel.root.getByText('VAE Decode')
      ).not.toBeVisible()
    })

    test('shows all nodes when search is cleared', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await propertiesPanel.searchBox.fill('seed')
      await propertiesPanel.searchBox.fill('')

      await expect(propertiesPanel.root.getByText('KSampler')).toBeVisible()
      await expect(
        propertiesPanel.root.getByText('VAE Decode')
      ).toBeVisible()
    })

    test('shows no results message when search matches nothing', async ({
      comfyPage
    }) => {
      const { propertiesPanel } = comfyPage

      await propertiesPanel.searchBox.fill('nonexistent_widget_xyz')

      await expect(propertiesPanel.noResultsMessage).toBeVisible()
    })
  })

  test.describe('Search with single node selected', () => {
    test('filters widgets within single node', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await comfyPage.selectNodes(['KSampler'])
      await propertiesPanel.searchBox.fill('cfg')

      await expect(propertiesPanel.root.getByText('cfg')).toBeVisible()
      await expect(
        propertiesPanel.root.getByText('seed', { exact: true })
      ).not.toBeVisible()
    })
  })

  test.describe('Search in workflow overview mode', () => {
    test('Nodes tab has search functionality', async ({ comfyPage }) => {
      const { propertiesPanel } = comfyPage

      await propertiesPanel.clickTab('Nodes')

      await expect(propertiesPanel.searchBox).toBeVisible()
    })
  })
})
