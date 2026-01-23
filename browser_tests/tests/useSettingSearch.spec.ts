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
            id: 'TestHiddenSetting' as TestSettingId,
            name: 'Test Hidden Setting',
            type: 'hidden',
            defaultValue: 'hidden_value',
            category: ['Test', 'Hidden']
          },
          {
            id: 'TestDeprecatedSetting' as TestSettingId,
            name: 'Test Deprecated Setting',
            type: 'text',
            defaultValue: 'deprecated_value',
            deprecated: true,
            category: ['Test', 'Deprecated']
          },
          {
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
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await expect(searchBox).toBeVisible()

    await expect(searchBox).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Search')
    )
  })

  test('search box is functional and accepts input', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await searchBox.fill('Comfy')

    await expect(searchBox).toHaveValue('Comfy')
  })

  test('search box clears properly', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await searchBox.fill('test')
    await expect(searchBox).toHaveValue('test')

    await searchBox.clear()
    await expect(searchBox).toHaveValue('')
  })

  test('settings categories are visible in sidebar', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const categories = settingsDialog.locator('nav [role="button"]')
    expect(await categories.count()).toBeGreaterThan(0)

    await expect(categories.first()).toBeVisible()
  })

  test('can select different categories in sidebar', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const categories = settingsDialog.locator('nav [role="button"]')
    const categoryCount = await categories.count()

    if (categoryCount > 1) {
      await categories.nth(1).click()

      await expect(categories.nth(1)).toHaveClass(
        /bg-interface-menu-component-surface-selected/
      )
    }
  })

  test('settings content area is visible', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const contentArea = settingsDialog.locator('main')
    await expect(contentArea).toBeVisible()
  })

  test('search functionality affects UI state', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await searchBox.fill('graph')

    await expect(searchBox).toHaveValue('graph')
  })

  test('settings dialog can be closed', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')

    await expect(settingsDialog).not.toBeVisible()
  })

  test('search box has proper debouncing behavior', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await searchBox.fill('a')
    await searchBox.fill('ab')
    await searchBox.fill('abc')
    await searchBox.fill('abcd')

    await expect(searchBox).toHaveValue('abcd')
  })

  test('search excludes hidden settings from results', async ({
    comfyPage
  }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await searchBox.fill('Test')

    const contentArea = settingsDialog.locator('main')

    await expect(contentArea).toContainText('Test Visible Setting')
    await expect(contentArea).not.toContainText('Test Hidden Setting')
  })

  test('search excludes deprecated settings from results', async ({
    comfyPage
  }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await searchBox.fill('Test')

    const contentArea = settingsDialog.locator('main')

    await expect(contentArea).toContainText('Test Visible Setting')
    await expect(contentArea).not.toContainText('Test Deprecated Setting')
  })

  test('search shows visible settings but excludes hidden and deprecated', async ({
    comfyPage
  }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    await searchBox.fill('Test')

    const contentArea = settingsDialog.locator('main')

    await expect(contentArea).toContainText('Test Visible Setting')

    await expect(contentArea).not.toContainText('Test Hidden Setting')
    await expect(contentArea).not.toContainText('Test Deprecated Setting')
  })

  test('search by setting name excludes hidden and deprecated', async ({
    comfyPage
  }) => {
    await comfyPage.page.keyboard.press('Control+,')
    const settingsDialog = comfyPage.page.locator(
      '[data-testid="settings-dialog"]'
    )
    await expect(settingsDialog).toBeVisible()

    const searchBox = settingsDialog.locator('input[placeholder*="Search"]')
    const contentArea = settingsDialog.locator('main')

    await searchBox.clear()
    await searchBox.fill('Hidden')

    await expect(contentArea).not.toContainText('Test Hidden Setting')

    await searchBox.clear()
    await searchBox.fill('Deprecated')

    await expect(contentArea).not.toContainText('Test Deprecated Setting')

    await searchBox.clear()
    await searchBox.fill('Visible')

    await expect(contentArea).toContainText('Test Visible Setting')
  })
})
