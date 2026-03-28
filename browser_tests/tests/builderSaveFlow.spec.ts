import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { setupBuilder } from '../helpers/builderTestUtils'
import { fitToViewInstant } from '../helpers/fitToView'

test.describe('Builder save flow', { tag: ['@ui'] }, () => {
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
    const { appMode } = comfyPage
    const { saveAs } = appMode
    await setupBuilder(comfyPage)
    await appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })
    await expect(saveAs.nameInput).toBeVisible()
    await expect(saveAs.title).toBeVisible()
    await expect(saveAs.radioGroup).toBeVisible()
  })

  test('Save as dialog allows entering filename and saving', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const { saveAs } = appMode
    await setupBuilder(comfyPage)
    await appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })

    await saveAs.nameInput.fill(`${Date.now()} builder-save-test`)
    await expect(saveAs.saveButton).toBeEnabled()
    await saveAs.saveButton.click()

    await expect(saveAs.successMessage).toBeVisible({ timeout: 5000 })
  })

  test('Save as dialog disables save when filename is empty', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const { saveAs } = appMode
    await setupBuilder(comfyPage)
    await appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })
    await saveAs.nameInput.fill('')
    await expect(saveAs.saveButton).toBeDisabled()
  })

  test('View type can be toggled in save-as dialog', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    const { saveAs } = appMode
    await setupBuilder(comfyPage)
    await appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })

    const appRadio = saveAs.viewTypeRadio('App')
    await expect(appRadio).toHaveAttribute('aria-checked', 'true')

    const graphRadio = saveAs.viewTypeRadio('Node graph')
    await graphRadio.click()
    await expect(graphRadio).toHaveAttribute('aria-checked', 'true')
    await expect(appRadio).toHaveAttribute('aria-checked', 'false')
  })

  test('Builder step navigation works correctly', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    const { footer } = appMode
    await setupBuilder(comfyPage)

    await appMode.steps.goToInputs()

    await expect(footer.backButton).toBeDisabled()
    await expect(footer.nextButton).toBeEnabled()

    await footer.next()
    await expect(footer.backButton).toBeEnabled()

    await footer.next()
    await expect(footer.nextButton).toBeDisabled()
  })

  test('Escape key exits builder mode', async ({ comfyPage }) => {
    await setupBuilder(comfyPage)

    await expect(comfyPage.appMode.steps.toolbar).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()

    await expect(comfyPage.appMode.steps.toolbar).not.toBeVisible()
  })

  test('Exit builder button exits builder mode', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage)

    await expect(appMode.steps.toolbar).toBeVisible()
    await appMode.footer.exitBuilder()
    await expect(appMode.steps.toolbar).not.toBeVisible()
  })

  test('Save button directly saves for previously saved workflow', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const { footer, saveAs } = appMode
    await setupBuilder(comfyPage)

    // First save via save-as to make it non-temporary
    await footer.saveAsButton.click()
    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })
    await saveAs.nameInput.fill(`${Date.now()} builder-direct-save`)
    await saveAs.saveButton.click()

    await expect(saveAs.successMessage).toBeVisible({ timeout: 5000 })
    await saveAs.closeButton.click()
    await comfyPage.nextFrame()

    // Modify the workflow so the save button becomes enabled
    await appMode.steps.goToInputs()
    await appMode.select.deleteInput('seed')
    await expect(footer.saveButton).toBeEnabled({ timeout: 5000 })

    // Now click save - should save directly without dialog
    await footer.saveButton.click()
    await comfyPage.nextFrame()

    await expect(saveAs.dialog).not.toBeVisible({ timeout: 2000 })
    await expect(footer.saveButton).toBeDisabled()
  })

  test('Split button chevron opens save-as for saved workflow', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const { footer, saveAs } = appMode
    await setupBuilder(comfyPage)

    // First save via save-as to make it non-temporary
    await footer.saveAsButton.click()
    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })
    await saveAs.nameInput.fill(`${Date.now()} builder-split-btn`)
    await saveAs.saveButton.click()

    await expect(saveAs.successMessage).toBeVisible({ timeout: 5000 })
    await saveAs.closeButton.click()
    await comfyPage.nextFrame()

    // Open save-as from chevron
    await footer.openSaveAsFromChevron()

    await expect(saveAs.title).toBeVisible({ timeout: 5000 })
    await expect(saveAs.nameInput).toBeVisible()
  })

  test('Connect output popover appears when no outputs selected', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await comfyPage.workflow.loadWorkflow('default')
    await fitToViewInstant(comfyPage)
    await appMode.enterBuilder()

    await appMode.footer.saveAsButton.click()

    await expect(
      comfyPage.page.getByText('Connect an output', { exact: false })
    ).toBeVisible({ timeout: 5000 })
  })
})
