import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Node library sidebar V2', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', true)

    const tab = comfyPage.menu.nodeLibraryTabV2
    await tab.open()
  })

  test('Shows search input and tab buttons', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.searchInput).toBeVisible()
    await expect(tab.allTab).toBeVisible()
    await expect(tab.blueprintsTab).toBeVisible()
  })

  test('All tab is selected by default', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')
  })

  test('Can switch between tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.blueprintsTab.click()
    await expect(tab.blueprintsTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.allTab).toHaveAttribute('aria-selected', 'false')

    await tab.allTab.click()
    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.blueprintsTab).toHaveAttribute('aria-selected', 'false')
  })

  test('All tab displays node tree with folders', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.allTab).toHaveAttribute('aria-selected', 'true')
    await expect(tab.getFolder('sampling').first()).toBeVisible()
  })

  test('Can expand folder and see nodes in All tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.getFolder('sampling').first().click()
    await expect(tab.getNode('KSampler (Advanced)').first()).toBeVisible()
  })

  test('Search filters nodes in All tab', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await tab.searchInput.click()
    await tab.searchInput.fill('KSampler')
    // Wait for debounced search to take effect
    await expect(tab.getNode('KSampler (Advanced)').first()).toBeVisible({
      timeout: 5000
    })
  })

  test('Sort button is visible', async ({ comfyPage }) => {
    const tab = comfyPage.menu.nodeLibraryTabV2

    await expect(tab.sortButton).toBeVisible()
  })
})
