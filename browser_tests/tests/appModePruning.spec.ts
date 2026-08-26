import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { setupBuilder } from '@e2e/fixtures/utils/builderTestUtils'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

const RESIZE_NODE_TITLE = 'Resize Image/Mask'
const RESIZE_NODE_ID = '1'
const SAVE_IMAGE_NODE_ID = '9'

/**
 * Load the dynamic combo workflow, enter builder,
 * select a dynamic sub-widget as input and SaveImage as output.
 */
async function setupDynamicComboBuilder(comfyPage: ComfyPage) {
  const { appMode } = comfyPage
  await comfyPage.workflow.loadWorkflow('inputs/dynamic_combo')
  await fitToViewInstant(comfyPage)
  await appMode.enterBuilder()
  await appMode.steps.goToInputs()
  await appMode.select.selectInputWidget(RESIZE_NODE_TITLE, 'resize_type.width')
  await appMode.steps.goToOutputs()
  await appMode.select.selectOutputNode('Save Image')
}

test.describe('App Mode Pruning', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  })

  test('prunes deleted outputs', async ({ comfyPage }) => {
    const { appMode } = comfyPage

    // Enter builder with default workflow (seed input + SaveImage output)
    await setupBuilder(comfyPage)

    // Verify save-as dialog opens
    await appMode.footer.saveAsButton.click()
    await expect(appMode.saveAs.dialog).toBeVisible()
    await appMode.saveAs.dialog.press('Escape')

    // Exit builder, delete SaveImage node
    await appMode.footer.exitBuilder()
    await comfyPage.vueNodes.deleteNode(SAVE_IMAGE_NODE_ID)
    await expect(
      comfyPage.vueNodes.getNodeLocator(SAVE_IMAGE_NODE_ID)
    ).not.toBeAttached()

    // Re-enter builder - pruning should auto-clean stale outputs
    await appMode.enterBuilder()
    await appMode.steps.goToOutputs()
    await expect(appMode.outputPlaceholder).toBeVisible()

    // Verify can't save
    await appMode.footer.saveAsButton.click()
    await expect(appMode.connectOutputPopover).toBeVisible()
  })

  test('does not prune missing widgets when node still exists for dynamic widgets', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage

    await setupDynamicComboBuilder(comfyPage)
    await appMode.footer.exitBuilder()
    await fitToViewInstant(comfyPage)

    // Change dynamic combo from "scale dimensions" to "scale by multiplier"
    // This removes the width/height widgets and adds factor
    await comfyPage.vueNodes.selectComboOption(
      RESIZE_NODE_TITLE,
      'resize_type',
      'scale by multiplier'
    )

    // Re-enter builder - node exists but widget is gone
    await appMode.enterBuilder()
    await appMode.steps.goToInputs()

    // The input should still be listed but show "Widget not visible"
    const subtitle = appMode.select.getInputItemSubtitle('resize_type.width')
    await expect(subtitle).toHaveText('Widget not visible')
  })

  test('prunes missing widgets when node deleted', async ({ comfyPage }) => {
    const { appMode } = comfyPage

    await setupDynamicComboBuilder(comfyPage)
    await appMode.footer.exitBuilder()

    // Delete the ResizeImageMaskNode entirely
    await comfyPage.vueNodes.deleteNode(RESIZE_NODE_ID)

    // Re-enter builder - pruning should auto-clean stale inputs
    await appMode.enterBuilder()
    await appMode.steps.goToInputs()
    await expect(appMode.select.inputItems).toHaveCount(0)
  })
})
