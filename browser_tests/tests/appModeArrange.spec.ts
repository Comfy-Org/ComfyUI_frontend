import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { setupBuilder } from '@e2e/fixtures/utils/builderTestUtils'

test.describe('App mode arrange step', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.appMode.suppressVueNodeSwitchPopup()
  })

  test('Placeholder is shown when outputs are configured but no run has happened', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await setupBuilder(comfyPage)
    await appMode.steps.goToPreview()

    await expect(appMode.steps.previewButton).toHaveAttribute(
      'aria-current',
      'step'
    )
    await expect(appMode.arrangePreview).toBeVisible()
    await expect(appMode.arrangeNoOutputs).toBeHidden()
  })

  test('No-outputs state navigates to the Outputs step via "Switch to Outputs"', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await appMode.enterBuilder()
    await appMode.steps.goToPreview()

    await expect(appMode.arrangeNoOutputs).toBeVisible()
    await expect(appMode.arrangePreview).toBeHidden()

    await appMode.arrangeSwitchToOutputsButton.click()

    await expect(appMode.steps.outputsButton).toHaveAttribute(
      'aria-current',
      'step'
    )
    await expect(appMode.arrangeNoOutputs).toBeHidden()
  })

  test('Connect-output popover from preview step navigates to the Outputs step', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await appMode.enterBuilder()
    // From a non-select step (preview/arrange), the popover surfaces a
    // "Switch to Outputs" shortcut alongside cancel.
    await appMode.steps.goToPreview()

    await appMode.footer.saveAsButton.click()
    await expect(appMode.connectOutputPopover).toBeVisible()
    await expect(appMode.connectOutputSwitchButton).toBeVisible()

    await appMode.connectOutputSwitchButton.click()
    await expect(appMode.connectOutputPopover).toBeHidden()
    await expect(appMode.steps.outputsButton).toHaveAttribute(
      'aria-current',
      'step'
    )
  })
})
