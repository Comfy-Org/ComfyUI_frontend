import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { mockSystemStats } from '../../fixtures/data/systemStats'

const MOCK_COMFYUI_VERSION = '9.99.0-e2e-test'

test.describe('Settings dialog', { tag: '@ui' }, () => {
  test('About panel renders mocked version from server', async ({
    comfyPage
  }) => {
    const stats = {
      ...mockSystemStats,
      system: {
        ...mockSystemStats.system,
        comfyui_version: MOCK_COMFYUI_VERSION
      }
    }
    await comfyPage.page.route('**/system_stats**', async (route) => {
      await route.fulfill({ json: stats })
    })
    await comfyPage.setup()

    const dialog = comfyPage.settingDialog
    await dialog.open()
    await dialog.goToAboutPanel()

    const aboutPanel = comfyPage.page.getByTestId('about-panel')
    await expect(aboutPanel).toBeVisible()
    await expect(aboutPanel).toContainText(MOCK_COMFYUI_VERSION)
    await expect(aboutPanel).toContainText('ComfyUI_frontend')
  })

  test('Toggling a boolean setting through UI persists the value', async ({
    comfyPage
  }) => {
    const settingId = 'Comfy.Validation.Workflows'
    const initialValue = await comfyPage.settings.getSetting<boolean>(settingId)

    const dialog = comfyPage.settingDialog
    await dialog.open()

    try {
      await dialog.searchBox.fill('Validate workflows')
      const settingRow = dialog.root.locator(`[data-setting-id="${settingId}"]`)
      await expect(settingRow).toBeVisible()

      await settingRow.locator('.p-toggleswitch').click()

      await expect
        .poll(() => comfyPage.settings.getSetting<boolean>(settingId))
        .toBe(!initialValue)
    } finally {
      await comfyPage.settings.setSetting(settingId, initialValue)
    }
  })

  test('Can be closed via close button', async ({ comfyPage }) => {
    const dialog = comfyPage.settingDialog
    await dialog.open()
    await expect(dialog.root).toBeVisible()

    await dialog.close()
    await expect(dialog.root).not.toBeVisible()
  })

  test('Escape key closes dialog', async ({ comfyPage }) => {
    const dialog = comfyPage.settingDialog
    await dialog.open()
    await expect(dialog.root).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog.root).not.toBeVisible()
  })

  test('Search filters settings list', async ({ comfyPage }) => {
    const dialog = comfyPage.settingDialog
    await dialog.open()

    const settingItems = dialog.root.locator('[data-setting-id]')
    const countBeforeSearch = await settingItems.count()

    await dialog.searchBox.fill('Validate workflows')
    await expect
      .poll(() => settingItems.count())
      .toBeLessThan(countBeforeSearch)
  })

  test('Search can be cleared to restore all settings', async ({
    comfyPage
  }) => {
    const dialog = comfyPage.settingDialog
    await dialog.open()

    const settingItems = dialog.root.locator('[data-setting-id]')
    const countBeforeSearch = await settingItems.count()

    await dialog.searchBox.fill('Validate workflows')
    await expect
      .poll(() => settingItems.count())
      .toBeLessThan(countBeforeSearch)

    await dialog.searchBox.clear()
    await expect.poll(() => settingItems.count()).toBe(countBeforeSearch)
  })

  test('Category navigation changes content area', async ({ comfyPage }) => {
    const dialog = comfyPage.settingDialog
    await dialog.open()

    const firstCategory = dialog.categories.first()
    const firstCategoryName = await firstCategory.textContent()
    await firstCategory.click()
    const firstContent = await dialog.contentArea.textContent()

    // Find a different category to click
    const categoryCount = await dialog.categories.count()
    let switched = false
    for (let i = 1; i < categoryCount; i++) {
      const cat = dialog.categories.nth(i)
      const catName = await cat.textContent()
      if (catName !== firstCategoryName) {
        await cat.click()
        await expect
          .poll(() => dialog.contentArea.textContent())
          .not.toBe(firstContent)
        switched = true
        break
      }
    }
    expect(switched).toBe(true)
  })

  test('Boolean setting persists after page reload', async ({ comfyPage }) => {
    const settingId = 'Comfy.Node.MiddleClickRerouteNode'
    const initialValue = await comfyPage.settings.getSetting<boolean>(settingId)

    try {
      await comfyPage.settings.setSetting(settingId, !initialValue)

      await expect
        .poll(() => comfyPage.settings.getSetting<boolean>(settingId))
        .toBe(!initialValue)

      await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
      await comfyPage.page.waitForFunction(
        () => window.app && window.app.extensionManager
      )

      await expect
        .poll(() => comfyPage.settings.getSetting<boolean>(settingId))
        .toBe(!initialValue)

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.LiteGraph!.middle_click_slot_add_default_node
          )
        )
        .toBe(!initialValue)
    } finally {
      await comfyPage.settings.setSetting(settingId, initialValue)
    }
  })

  test('Dropdown setting can be changed and persists', async ({
    comfyPage
  }) => {
    const settingId = 'Comfy.UseNewMenu'
    const initialValue = await comfyPage.settings.getSetting<string>(settingId)

    const dialog = comfyPage.settingDialog
    await dialog.open()

    try {
      await dialog.searchBox.fill('Use new menu')
      const settingRow = dialog.root.locator(`[data-setting-id="${settingId}"]`)
      await expect(settingRow).toBeVisible()

      // Click the PrimeVue Select to open the dropdown
      await settingRow.locator('.p-select').click()
      const overlay = comfyPage.page.locator('.p-select-overlay')
      await expect(overlay).toBeVisible()

      // Pick the option that is not the current value
      const targetValue = initialValue === 'Top' ? 'Disabled' : 'Top'
      await overlay
        .locator(`.p-select-option-label:text-is("${targetValue}")`)
        .click()

      await expect
        .poll(() => comfyPage.settings.getSetting<string>(settingId))
        .toBe(targetValue)
    } finally {
      await comfyPage.settings.setSetting(settingId, initialValue)
    }
  })
})
