import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { setupSubgraphBuilder } from '../helpers/builderTestUtils'
import { fitToViewInstant } from '../helpers/fitToView'

test.describe('Builder save flow', { tag: ['@ui', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.api.serverFeatureFlags.value = {
        ...window.app!.api.serverFeatureFlags.value,
        linear_toggle_enabled: true
      }
    })
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  })

  test('Save as dialog appears for unsaved workflow', async ({ comfyPage }) => {
    const { page, appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)
    await appMode.goToPreview()
    await appMode.clickSave()

    // The save-as dialog should appear with filename input and view type selection
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByRole('textbox')).toBeVisible()
    await expect(dialog.getByText('Save as')).toBeVisible()

    // View type radio group should be present
    const radioGroup = dialog.getByRole('radiogroup')
    await expect(radioGroup).toBeVisible()
  })

  test('Save as dialog allows entering filename and saving', async ({
    comfyPage
  }) => {
    const { page, appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)
    await appMode.goToPreview()
    await appMode.clickSave()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    const workflowName = `${Date.now()} builder-save-test`
    const input = dialog.getByRole('textbox')
    await input.fill(workflowName)

    // Save button should be enabled now
    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Success dialog should appear
    const successDialog = page.getByRole('dialog')
    await expect(successDialog.getByText('Successfully saved')).toBeVisible({
      timeout: 5000
    })
  })

  test('Save as dialog disables save when filename is empty', async ({
    comfyPage
  }) => {
    const { page, appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)
    await appMode.goToPreview()
    await appMode.clickSave()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Clear the filename input
    const input = dialog.getByRole('textbox')
    await input.fill('')

    // Save button should be disabled
    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeDisabled()
  })

  test('Builder step navigation works correctly', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // Should start at outputs (we ended there in setup)
    // Navigate to inputs
    await appMode.goToInputs()

    // Back button should be disabled on first step
    const backButton = appMode.getFooterButton('Back')
    await expect(backButton).toBeDisabled()

    // Next button should be enabled
    const nextButton = appMode.getFooterButton('Next')
    await expect(nextButton).toBeEnabled()

    // Navigate forward
    await appMode.next()

    // Back button should now be enabled
    await expect(backButton).toBeEnabled()

    // Navigate to preview (last step)
    await appMode.next()

    // Next button should be disabled on last step
    await expect(nextButton).toBeDisabled()
  })

  test('Escape key exits builder mode', async ({ comfyPage }) => {
    const { page } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    // Verify builder toolbar is visible
    const toolbar = page.getByRole('navigation', { name: 'App Builder' })
    await expect(toolbar).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')
    await comfyPage.nextFrame()

    // Builder toolbar should be gone
    await expect(toolbar).not.toBeVisible()
  })

  test('Exit builder button exits builder mode', async ({ comfyPage }) => {
    const { page, appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)

    const toolbar = page.getByRole('navigation', { name: 'App Builder' })
    await expect(toolbar).toBeVisible()

    await appMode.exitBuilder()

    await expect(toolbar).not.toBeVisible()
  })

  test('Save button directly saves for previously saved workflow', async ({
    comfyPage
  }) => {
    const { page, appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)
    await appMode.goToPreview()

    // First save via builder save-as to make it non-temporary
    await appMode.clickSave()
    const saveAsDialog = page.getByRole('dialog')
    await expect(saveAsDialog).toBeVisible({ timeout: 5000 })
    const workflowName = `${Date.now()} builder-direct-save`
    await saveAsDialog.getByRole('textbox').fill(workflowName)
    await saveAsDialog.getByRole('button', { name: 'Save' }).click()

    // Dismiss the success dialog
    const successDialog = page.getByRole('dialog')
    await expect(successDialog.getByText('Successfully saved')).toBeVisible({
      timeout: 5000
    })
    await successDialog.getByText('Close', { exact: true }).click()
    await comfyPage.nextFrame()

    // Now click save again — should save directly and show success
    await appMode.clickSave()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Successfully saved')).toBeVisible({
      timeout: 5000
    })
  })

  test('Split button chevron opens save-as for saved workflow', async ({
    comfyPage
  }) => {
    const { page, appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)
    await appMode.goToPreview()

    // First save via builder save-as to make it non-temporary
    await appMode.clickSave()
    const saveAsDialog = page.getByRole('dialog')
    await expect(saveAsDialog).toBeVisible({ timeout: 5000 })
    const workflowName = `${Date.now()} builder-split-btn`
    await saveAsDialog.getByRole('textbox').fill(workflowName)
    await saveAsDialog.getByRole('button', { name: 'Save' }).click()

    // Dismiss the success dialog
    const successDialog = page.getByRole('dialog')
    await expect(successDialog.getByText('Successfully saved')).toBeVisible({
      timeout: 5000
    })
    await successDialog.getByText('Close', { exact: true }).click()
    await comfyPage.nextFrame()

    // Click the chevron dropdown trigger
    const chevronButton = appMode.getFooterButton('Save as')
    await chevronButton.click()

    // "Save as" menu item should appear
    const menuItem = page.getByRole('menuitem', { name: 'Save as' })
    await expect(menuItem).toBeVisible({ timeout: 5000 })
    await menuItem.click()

    // Save-as dialog should appear
    const newSaveAsDialog = page.getByRole('dialog')
    await expect(newSaveAsDialog.getByText('Save as')).toBeVisible({
      timeout: 5000
    })
    await expect(newSaveAsDialog.getByRole('textbox')).toBeVisible()
  })

  test('Connect output popover appears when no outputs selected', async ({
    comfyPage
  }) => {
    const { page, appMode } = comfyPage
    await comfyPage.workflow.loadWorkflow('default')
    await fitToViewInstant(comfyPage)
    await appMode.enterBuilder()

    // Without selecting any outputs, click the save button
    // It should trigger the connect-output popover
    await appMode.clickSave()

    // The popover should show a message about connecting outputs
    await expect(
      page.getByText('Connect an output', { exact: false })
    ).toBeVisible({ timeout: 5000 })
  })

  test('View type can be toggled in save-as dialog', async ({ comfyPage }) => {
    const { page, appMode } = comfyPage
    await setupSubgraphBuilder(comfyPage)
    await appMode.goToPreview()
    await appMode.clickSave()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // App should be selected by default
    const appRadio = dialog.getByRole('radio', { name: /App/ })
    await expect(appRadio).toHaveAttribute('aria-checked', 'true')

    // Click Node graph option
    const graphRadio = dialog.getByRole('radio', { name: /Node graph/ })
    await graphRadio.click()
    await expect(graphRadio).toHaveAttribute('aria-checked', 'true')
    await expect(appRadio).toHaveAttribute('aria-checked', 'false')
  })
})
