import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { BuilderSaveAsHelper } from '@e2e/fixtures/helpers/BuilderSaveAsHelper'
import {
  builderSaveAs,
  openWorkflowFromSidebar,
  setupBuilder
} from '@e2e/fixtures/utils/builderTestUtils'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

/**
 * After a first save, reopen the save-as dialog via the top-left
 * builder menu ("App builder" → "Save as"), fill name + view type,
 * and save. Replaces the retired footer chevron affordance.
 */
async function reSaveAs(
  comfyPage: ComfyPage,
  workflowName: string,
  viewType: 'App' | 'Node graph'
) {
  const { page, appMode } = comfyPage
  await page.getByRole('button', { name: 'App builder' }).click()
  await page.getByRole('button', { name: 'Save as' }).click()
  await expect(appMode.saveAs.nameInput).toBeVisible()
  await appMode.saveAs.fillAndSave(workflowName, viewType)
}

async function dismissSuccessDialog(
  saveAs: BuilderSaveAsHelper,
  button: 'close' | 'dismiss' = 'close'
) {
  const btn = button === 'close' ? saveAs.closeButton : saveAs.dismissButton
  await btn.click()
  await expect(saveAs.successDialog).toBeHidden()
}

test.describe('Builder save flow', { tag: ['@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  })

  test('Save as dialog appears for unsaved workflow', async ({ comfyPage }) => {
    const { saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)
    await comfyPage.appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible()
    await expect(saveAs.nameInput).toBeVisible()
    await expect(saveAs.title).toBeVisible()
    await expect(saveAs.radioGroup).toBeVisible()
  })

  test('Save as dialog allows entering filename and saving', async ({
    comfyPage
  }) => {
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, `${Date.now()} builder-save`, 'App')
  })

  test('Save as dialog disables save when filename is empty', async ({
    comfyPage
  }) => {
    const { saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)
    await comfyPage.appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible()
    await saveAs.nameInput.fill('')
    await expect(saveAs.saveButton).toBeDisabled()
  })

  test('View type can be toggled in save-as dialog', async ({ comfyPage }) => {
    const { saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)
    await comfyPage.appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible()

    const appRadio = saveAs.viewTypeRadio('App')
    await expect(appRadio).toHaveAttribute('aria-checked', 'true')

    const graphRadio = saveAs.viewTypeRadio('Node graph')
    await graphRadio.click()
    await expect(graphRadio).toHaveAttribute('aria-checked', 'true')
    await expect(appRadio).toHaveAttribute('aria-checked', 'false')
  })

  test('Builder step navigation works correctly', async ({ comfyPage }) => {
    const { footer } = comfyPage.appMode
    await setupBuilder(comfyPage)

    await comfyPage.appMode.steps.goToInputs()

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

    await comfyPage.keyboard.press('Escape')

    await expect(comfyPage.appMode.steps.toolbar).toBeHidden()
  })

  test('Exit builder button exits builder mode', async ({ comfyPage }) => {
    await setupBuilder(comfyPage)

    await expect(comfyPage.appMode.steps.toolbar).toBeVisible()
    await comfyPage.appMode.footer.exitBuilder()
    await expect(comfyPage.appMode.steps.toolbar).toBeHidden()
  })

  test('Save button directly saves for previously saved workflow', async ({
    comfyPage
  }) => {
    const { footer, saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)

    await builderSaveAs(comfyPage.appMode, `${Date.now()} direct-save`, 'App')
    await dismissSuccessDialog(saveAs)

    // Modify the workflow so the save button becomes enabled
    await comfyPage.appMode.steps.goToInputs()
    await comfyPage.appMode.select.deleteInput('seed')
    await expect(footer.saveButton).toBeEnabled()

    await footer.saveButton.click()
    await comfyPage.nextFrame()

    await expect(saveAs.dialog).toBeHidden()
    await expect(footer.saveButton).toBeDisabled()
  })

  test('Save As menu item opens save-as dialog for saved workflow', async ({
    comfyPage
  }) => {
    // The footer's Save/Save-As split button was simplified to a single
    // Save pill; "Save As" now lives in the top-left builder menu.
    const { saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)

    await builderSaveAs(comfyPage.appMode, `${Date.now()} menu-save-as`, 'App')
    await dismissSuccessDialog(saveAs)

    await comfyPage.page.getByRole('button', { name: 'App builder' }).click()
    await comfyPage.page.getByRole('button', { name: 'Save as' }).click()

    await expect(saveAs.title).toBeVisible()
    await expect(saveAs.nameInput).toBeVisible()
  })

  test('Connect output popover appears when no outputs selected', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await fitToViewInstant(comfyPage)
    await comfyPage.appMode.enterBuilder()

    await comfyPage.appMode.footer.saveAsButton.click()

    await expect(
      comfyPage.page.getByText('Connect an output', { exact: false })
    ).toBeVisible()
  })

  test('save as app produces correct extension and linearMode', async ({
    comfyPage
  }) => {
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, `${Date.now()} app-ext`, 'App')

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .toContain('.app.json')

    await expect
      .poll(() => comfyPage.workflow.getLinearModeFromGraph())
      .toBe(true)
  })

  test('save as node graph produces correct extension and linearMode', async ({
    comfyPage
  }) => {
    await setupBuilder(comfyPage)
    await builderSaveAs(
      comfyPage.appMode,
      `${Date.now()} graph-ext`,
      'Node graph'
    )

    await expect(async () => {
      const path = await comfyPage.workflow.getActiveWorkflowPath()
      expect(path).toMatch(/\.json$/)
      expect(path).not.toContain('.app.json')
    }).toPass({ timeout: 5000 })

    await expect
      .poll(() => comfyPage.workflow.getLinearModeFromGraph())
      .toBe(false)
  })

  test('save as app View App button enters app mode', async ({ comfyPage }) => {
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, `${Date.now()} app-view`, 'App')

    await comfyPage.appMode.saveAs.viewAppButton.click()
    await expect(comfyPage.appMode.saveAs.successDialog).toBeHidden()

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowActiveAppMode())
      .toBe('app')
  })

  test('save as node graph Exit builder exits builder mode', async ({
    comfyPage
  }) => {
    await setupBuilder(comfyPage)
    await builderSaveAs(
      comfyPage.appMode,
      `${Date.now()} graph-exit`,
      'Node graph'
    )

    await comfyPage.appMode.saveAs.exitBuilderButton.click()
    await expect(comfyPage.appMode.saveAs.successDialog).toBeHidden()

    await expect(comfyPage.appMode.steps.toolbar).toBeHidden()
  })

  test('save as with different mode does not modify the original workflow', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage)

    const originalName = `${Date.now()} original`
    await builderSaveAs(appMode, originalName, 'App')
    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .toContain('.app.json')
    await dismissSuccessDialog(appMode.saveAs)

    // Re-save as node graph — creates a copy
    await reSaveAs(comfyPage, `${Date.now()} copy`, 'Node graph')
    await expect(appMode.saveAs.successMessage).toBeVisible()

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .not.toContain('.app.json')

    // Dismiss success dialog, exit app mode, reopen the original
    await dismissSuccessDialog(appMode.saveAs, 'dismiss')
    await appMode.toggleAppMode()
    await openWorkflowFromSidebar(comfyPage, originalName)

    await expect
      .poll(() => comfyPage.workflow.getLinearModeFromGraph())
      .toBe(true)
  })

  test('save as with same name and same mode overwrites in place', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const name = `${Date.now()} overwrite`
    await setupBuilder(comfyPage)

    await builderSaveAs(appMode, name, 'App')
    await dismissSuccessDialog(appMode.saveAs)
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .toContain('.app.json')
    const pathAfterFirst = await comfyPage.workflow.getActiveWorkflowPath()

    await reSaveAs(comfyPage, name, 'App')

    await expect(appMode.saveAs.overwriteDialog).toBeVisible()
    await appMode.saveAs.overwriteButton.click()
    await expect(appMode.saveAs.overwriteDialog).toBeHidden()

    await expect(appMode.saveAs.successMessage).toBeVisible()

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .toBe(pathAfterFirst)
  })

  test('save as with same name but different mode creates a new file', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const name = `${Date.now()} mode-change`
    await setupBuilder(comfyPage)

    await builderSaveAs(appMode, name, 'App')
    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .toContain('.app.json')
    const pathAfterFirst = await comfyPage.workflow.getActiveWorkflowPath()
    await dismissSuccessDialog(appMode.saveAs)

    await reSaveAs(comfyPage, name, 'Node graph')
    await expect(appMode.saveAs.successMessage).toBeVisible()

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .not.toBe(pathAfterFirst)
    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .toMatch(/\.json$/)
    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowPath())
      .not.toContain('.app.json')
  })

  test('save as app workflow reloads in app mode', async ({ comfyPage }) => {
    const name = `${Date.now()} reload-app`
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, name, 'App')
    await dismissSuccessDialog(comfyPage.appMode.saveAs, 'dismiss')
    await comfyPage.appMode.footer.exitBuilder()

    await openWorkflowFromSidebar(comfyPage, name)

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowInitialMode())
      .toBe('app')
  })

  test('save as node graph workflow reloads in node graph mode', async ({
    comfyPage
  }) => {
    const name = `${Date.now()} reload-graph`
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, name, 'Node graph')
    await dismissSuccessDialog(comfyPage.appMode.saveAs, 'dismiss')
    await comfyPage.appMode.toggleAppMode()

    await openWorkflowFromSidebar(comfyPage, name)

    await expect
      .poll(() => comfyPage.workflow.getActiveWorkflowInitialMode())
      .toBe('graph')
  })
})
