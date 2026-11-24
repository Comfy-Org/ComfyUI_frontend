import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Swedish locale', { tag: ['@settings', '@i18n'] }, () => {
  test('selects Svenska and keeps Swedish menu labels after reload', async ({
    comfyPage
  }) => {
    await comfyPage.settingDialog.selectLocale('sv')

    await expect
      .poll(() => comfyPage.settings.getPersistedSetting('Comfy.Locale'))
      .toBe('sv')

    await comfyPage.page.reload()
    await comfyPage.page.waitForFunction(() => window.app !== undefined)
    await expect
      .poll(() => comfyPage.settings.getPersistedSetting('Comfy.Locale'))
      .toBe('sv')

    const menuButton = comfyPage.page.getByTestId('comfy-menu-button')
    await expect(menuButton).toHaveAttribute('aria-label', 'Meny')
    await menuButton.click()
    await expect(
      comfyPage.page.getByRole('menuitem', {
        name: 'Inställningar',
        exact: true
      })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('menuitem', { name: 'Tillägg', exact: true })
    ).toBeVisible()
  })
})
