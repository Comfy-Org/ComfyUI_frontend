import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

async function enterBuilderExpectVueNodeSwitchPopup(comfyPage: ComfyPage) {
  const { appMode } = comfyPage
  await appMode.enterBuilder()
  await expect(appMode.vueNodeSwitchPopup).toBeVisible()
}

async function expectVueNodesEnabled(comfyPage: ComfyPage) {
  await expect
    .poll(() =>
      comfyPage.settings.getSetting<boolean>('Comfy.VueNodes.Enabled')
    )
    .toBe(true)
}

test.describe('Vue node switch notification popup', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.appMode.allowVueNodeSwitchPopup()
  })

  test('Popup appears when entering builder; dismiss closes without persisting and shows again on a later entry', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await enterBuilderExpectVueNodeSwitchPopup(comfyPage)

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

    // Disable vue nodes and re-enter builder
    await appMode.footer.exitBuilder()
    await comfyPage.menu.topbar.setVueNodesEnabled(false)
    await appMode.enterBuilder()

    await expectVueNodesEnabled(comfyPage)
    await expect(appMode.vueNodeSwitchPopup).toBeVisible()
  })

  test('"Don\'t show again" persists the dismissal and suppresses future popups', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await enterBuilderExpectVueNodeSwitchPopup(comfyPage)
    await expectVueNodesEnabled(comfyPage)

    // Dismiss with dont show again checked
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

    // Disable vue nodes and re-enter builder
    await appMode.footer.exitBuilder()
    await comfyPage.menu.topbar.setVueNodesEnabled(false)
    await appMode.enterBuilder()

    await expectVueNodesEnabled(comfyPage)
    await expect(appMode.vueNodeSwitchPopup).toBeHidden()
  })
})
