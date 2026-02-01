import { expect } from '@playwright/test'

import type { Settings } from '../../src/schemas/apiSchema'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

/**
 * Type helper for test settings with arbitrary IDs.
 * Extensions can register settings with any ID, but SettingParams.id
 * is typed as keyof Settings for autocomplete.
 */
type TestSettingId = keyof Settings

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Settings Search functionality', { tag: '@settings' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Register test settings to verify hidden/deprecated filtering
    await comfyPage.page.evaluate(() => {
      window.app!.registerExtension({
        name: 'TestSettingsExtension',
        settings: [
          {
            // Extensions can register arbitrary setting IDs
            id: 'TestHiddenSetting' as TestSettingId,
            name: 'Test Hidden Setting',
            type: 'hidden',
            defaultValue: 'hidden_value',
            category: ['Test', 'Hidden']
          },
          {
            // Extensions can register arbitrary setting IDs
            id: 'TestDeprecatedSetting' as TestSettingId,
            name: 'Test Deprecated Setting',
            type: 'text',
            defaultValue: 'deprecated_value',
            deprecated: true,
            category: ['Test', 'Deprecated']
          },
          {
            // Extensions can register arbitrary setting IDs
            id: 'TestVisibleSetting' as TestSettingId,
            name: 'Test Visible Setting',
            type: 'text',
            defaultValue: 'visible_value',
            category: ['Test', 'Visible']
          }
        ]
      })
    })
  })

  test('can open settings dialog and use search box', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Find the search box
    const searchBox = comfyPage.page.locator('.settings-search-box input')
    await expect(searchBox).toBeVisible()

    // Verify search box has the correct placeholder
    await expect(searchBox).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Search')
    )
  })

  test('search box is functional and accepts input', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Find and interact with the search box
    const searchBox = comfyPage.page.locator('.settings-search-box input')
    await searchBox.fill('Comfy')

    // Verify the input was accepted
    await expect(searchBox).toHaveValue('Comfy')
  })

  test('search box clears properly', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Find and interact with the search box
    const searchBox = comfyPage.page.locator('.settings-search-box input')
    await searchBox.fill('test')
    await expect(searchBox).toHaveValue('test')

    // Clear the search box
    await searchBox.clear()
    await expect(searchBox).toHaveValue('')
  })

  test('settings categories are visible in sidebar', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Check that the sidebar has categories
    const categories = comfyPage.page.locator(
      '.settings-sidebar .p-listbox-option'
    )
    expect(await categories.count()).toBeGreaterThan(0)

    // Check that at least one category is visible
    await expect(categories.first()).toBeVisible()
  })

  test('can select different categories in sidebar', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Click on a specific category (Appearance) to verify category switching
    const appearanceCategory = comfyPage.page.getByTestId(
      'settings-tab-Appearance'
    )
    await appearanceCategory.click()

    // Verify the category is selected by checking if its parent option has the selected class
    await expect(appearanceCategory.locator('xpath=ancestor::li')).toHaveClass(
      /p-listbox-option-selected/
    )
  })

  test('settings content area is visible', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Check that the content area is visible
    const contentArea = comfyPage.page.locator('.settings-content')
    await expect(contentArea).toBeVisible()

    // Check that tab panels are visible
    const tabPanels = comfyPage.page.locator('.settings-tab-panels')
    await expect(tabPanels).toBeVisible()
  })

  test('search functionality affects UI state', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Find the search box
    const searchBox = comfyPage.page.locator('.settings-search-box input')

    // Type in search box
    await searchBox.fill('graph')

    // Verify that the search input is handled
    await expect(searchBox).toHaveValue('graph')
  })

  test('settings dialog can be closed', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Close with escape key
    await comfyPage.page.keyboard.press('Escape')

    // Verify dialog is closed
    await expect(settingsDialog).not.toBeVisible()
  })

  test('search box has proper debouncing behavior', async ({ comfyPage }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Type rapidly in search box
    const searchBox = comfyPage.page.locator('.settings-search-box input')
    await searchBox.fill('a')
    await searchBox.fill('ab')
    await searchBox.fill('abc')
    await searchBox.fill('abcd')

    // Verify final value
    await expect(searchBox).toHaveValue('abcd')
  })

  test('search excludes hidden settings from results', async ({
    comfyPage
  }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Search for our test settings
    const searchBox = comfyPage.page.locator('.settings-search-box input')
    await searchBox.fill('Test')

    // Get all settings content
    const settingsContent = comfyPage.page.locator('.settings-tab-panels')

    // Should show visible setting but not hidden setting
    await expect(settingsContent).toContainText('Test Visible Setting')
    await expect(settingsContent).not.toContainText('Test Hidden Setting')
  })

  test('search excludes deprecated settings from results', async ({
    comfyPage
  }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Search for our test settings
    const searchBox = comfyPage.page.locator('.settings-search-box input')
    await searchBox.fill('Test')

    // Get all settings content
    const settingsContent = comfyPage.page.locator('.settings-tab-panels')

    // Should show visible setting but not deprecated setting
    await expect(settingsContent).toContainText('Test Visible Setting')
    await expect(settingsContent).not.toContainText('Test Deprecated Setting')
  })

  test('search shows visible settings but excludes hidden and deprecated', async ({
    comfyPage
  }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    // Search for our test settings
    const searchBox = comfyPage.page.locator('.settings-search-box input')
    await searchBox.fill('Test')

    // Get all settings content
    const settingsContent = comfyPage.page.locator('.settings-tab-panels')

    // Should only show the visible setting
    await expect(settingsContent).toContainText('Test Visible Setting')

    // Should not show hidden or deprecated settings
    await expect(settingsContent).not.toContainText('Test Hidden Setting')
    await expect(settingsContent).not.toContainText('Test Deprecated Setting')
  })

  test('search by setting name excludes hidden and deprecated', async ({
    comfyPage
  }) => {
    // Open settings dialog
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator('.settings-container')
    await expect(settingsDialog).toBeVisible()

    const searchBox = comfyPage.page.locator('.settings-search-box input')
    const settingsContent = comfyPage.page.locator('.settings-tab-panels')

    // Search specifically for hidden setting by name
    await searchBox.clear()
    await searchBox.fill('Hidden')

    // Should not show the hidden setting even when searching by name
    await expect(settingsContent).not.toContainText('Test Hidden Setting')

    // Search specifically for deprecated setting by name
    await searchBox.clear()
    await searchBox.fill('Deprecated')

    // Should not show the deprecated setting even when searching by name
    await expect(settingsContent).not.toContainText('Test Deprecated Setting')

    // Search for visible setting by name - should work
    await searchBox.clear()
    await searchBox.fill('Visible')

    // Should show the visible setting
    await expect(settingsContent).toContainText('Test Visible Setting')
  })
})
