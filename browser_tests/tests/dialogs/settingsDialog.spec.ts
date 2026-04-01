import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Settings dialog', { tag: '@ui' }, () => {
  test('About panel shows version badges', async ({ comfyPage }) => {
    const dialog = comfyPage.settingDialog
    await dialog.open()
    await dialog.goToAboutPanel()

    const aboutPanel = comfyPage.page.getByTestId('about-panel')
    await expect(aboutPanel).toBeVisible()
    await expect(aboutPanel.locator('.about-badge').first()).toBeVisible()
    await expect(aboutPanel).toContainText('ComfyUI_frontend')
  })

  test('Toggling a boolean setting through UI persists the value', async ({
    comfyPage
  }) => {
    const settingId = 'Comfy.Validation.Workflows'
    const initialValue = await comfyPage.settings.getSetting<boolean>(settingId)

    const dialog = comfyPage.settingDialog
    await dialog.open()

    await dialog.searchBox.fill('Validate workflows')
    const settingRow = dialog.root.locator(`[data-setting-id="${settingId}"]`)
    await expect(settingRow).toBeVisible()

    await settingRow.locator('.p-toggleswitch').click()

    await expect
      .poll(() => comfyPage.settings.getSetting<boolean>(settingId))
      .toBe(!initialValue)
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
    for (let i = 1; i < categoryCount; i++) {
      const cat = dialog.categories.nth(i)
      const catName = await cat.textContent()
      if (catName !== firstCategoryName) {
        await cat.click()
        await expect
          .poll(() => dialog.contentArea.textContent())
          .not.toBe(firstContent)
        return
      }
    }
  })

  test('Dropdown setting can be changed and persists', async ({
    comfyPage
  }) => {
    const settingId = 'Comfy.UseNewMenu'
    const initialValue = await comfyPage.settings.getSetting<string>(settingId)

    const dialog = comfyPage.settingDialog
    await dialog.open()

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

    // Restore original value
    await comfyPage.settings.setSetting(settingId, initialValue)
  })
})
