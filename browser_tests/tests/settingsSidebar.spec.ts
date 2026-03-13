import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('Settings Sidebar', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  test('Settings button is visible in sidebar', async ({ comfyPage }) => {
    await expect(comfyPage.menu.sideToolbar).toBeVisible()
    const settingsButton = comfyPage.menu.sideToolbar.getByLabel(/settings/i)
    await expect(settingsButton).toBeVisible()
  })

  test('Clicking settings button opens settings dialog', async ({
    comfyPage
  }) => {
    const settingsButton = comfyPage.menu.sideToolbar.getByLabel(/settings/i)
    await settingsButton.click()
    await expect(comfyPage.settingDialog.root).toBeVisible()
  })

  test('Settings dialog shows categories', async ({ comfyPage }) => {
    const settingsButton = comfyPage.menu.sideToolbar.getByLabel(/settings/i)
    await settingsButton.click()
    await expect(comfyPage.settingDialog.root).toBeVisible()
    await expect(comfyPage.settingDialog.categories.first()).toBeVisible()
    expect(await comfyPage.settingDialog.categories.count()).toBeGreaterThan(0)
  })

  test('Settings dialog can be closed with Escape', async ({ comfyPage }) => {
    const settingsButton = comfyPage.menu.sideToolbar.getByLabel(/settings/i)
    await settingsButton.click()
    await expect(comfyPage.settingDialog.root).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(comfyPage.settingDialog.root).not.toBeVisible()
  })

  test('Settings search box is functional', async ({ comfyPage }) => {
    const settingsButton = comfyPage.menu.sideToolbar.getByLabel(/settings/i)
    await settingsButton.click()
    await expect(comfyPage.settingDialog.root).toBeVisible()
    await comfyPage.settingDialog.searchBox.fill('color')
    await expect(comfyPage.settingDialog.searchBox).toHaveValue('color')
  })

  test('Settings dialog can navigate to About panel', async ({ comfyPage }) => {
    const settingsButton = comfyPage.menu.sideToolbar.getByLabel(/settings/i)
    await settingsButton.click()
    await expect(comfyPage.settingDialog.root).toBeVisible()
    await comfyPage.settingDialog.goToAboutPanel()
    await expect(comfyPage.page.locator('.about-container')).toBeVisible()
  })
})
