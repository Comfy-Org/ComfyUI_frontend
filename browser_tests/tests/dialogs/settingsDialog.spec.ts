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
})
