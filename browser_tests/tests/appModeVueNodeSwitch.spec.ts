import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue node switch notification popup', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.appMode.allowVueNodeSwitchPopup()
  })

  test('Popup appears when entering builder; dismiss closes without persisting', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await appMode.enterBuilder()
    await expect(appMode.vueNodeSwitchPopup).toBeVisible()

    await appMode.vueNodeSwitchDismissButton.click()
    await expect(appMode.vueNodeSwitchPopup).toBeHidden()

    // "Don't show again" was not checked → preference remains false
    await expect
      .poll(() =>
        comfyPage.settings.getSetting<boolean>(
          'Comfy.AppBuilder.VueNodeSwitchDismissed'
        )
      )
      .toBe(false)
  })

  test('"Don\'t show again" persists the dismissal and suppresses future popups', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await appMode.enterBuilder()
    await expect(appMode.vueNodeSwitchPopup).toBeVisible()

    // The auto-enable side effect should have flipped Comfy.VueNodes.Enabled
    // to true on entry — sanity-check the precondition for the suppression
    // assertion below.
    await expect
      .poll(() =>
        comfyPage.settings.getSetting<boolean>('Comfy.VueNodes.Enabled')
      )
      .toBe(true)

    await appMode.vueNodeSwitchDontShowAgainCheckbox.check()
    await appMode.vueNodeSwitchDismissButton.click()
    await expect(appMode.vueNodeSwitchPopup).toBeHidden()

    await expect
      .poll(() =>
        comfyPage.settings.getSetting<boolean>(
          'Comfy.AppBuilder.VueNodeSwitchDismissed'
        )
      )
      .toBe(true)

    // Re-trigger the auto-enable path: exit, then disable VueNodes again so
    // the next enterBuilder() runs autoEnableVueNodes from a clean state.
    // Order matters: setting VueNodes.Enabled=false while still in builder
    // could fire watchers mid-state.
    await appMode.footer.exitBuilder()
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
    await appMode.enterBuilder()

    // Auto-enable ran again (proves the suppression path was actually
    // exercised — otherwise the next assertion would pass vacuously).
    await expect
      .poll(() =>
        comfyPage.settings.getSetting<boolean>('Comfy.VueNodes.Enabled')
      )
      .toBe(true)
    await expect(appMode.vueNodeSwitchPopup).toBeHidden()
  })
})
