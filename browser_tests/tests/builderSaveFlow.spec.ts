import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import type { AppModeHelper } from '../fixtures/helpers/AppModeHelper'
import {
  builderSaveAs,
  openWorkflowFromSidebar,
  setupBuilder
} from '../helpers/builderTestUtils'
import { fitToViewInstant } from '../helpers/fitToView'

/**
 * After a first save, open save-as again from the chevron,
 * fill name + view type, and save.
 */
async function reSaveAs(
  appMode: AppModeHelper,
  workflowName: string,
  viewType: 'App' | 'Node graph'
) {
  await appMode.footer.openSaveAsFromChevron()
  await expect(appMode.saveAs.nameInput).toBeVisible({ timeout: 5000 })
  await appMode.saveAs.fillAndSave(workflowName, viewType)
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

    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })
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

    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })
    await saveAs.nameInput.fill('')
    await expect(saveAs.saveButton).toBeDisabled()
  })

  test('View type can be toggled in save-as dialog', async ({ comfyPage }) => {
    const { saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)
    await comfyPage.appMode.footer.saveAsButton.click()

    await expect(saveAs.dialog).toBeVisible({ timeout: 5000 })

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

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.nextFrame()

    await expect(comfyPage.appMode.steps.toolbar).not.toBeVisible()
  })

  test('Exit builder button exits builder mode', async ({ comfyPage }) => {
    await setupBuilder(comfyPage)

    await expect(comfyPage.appMode.steps.toolbar).toBeVisible()
    await comfyPage.appMode.footer.exitBuilder()
    await expect(comfyPage.appMode.steps.toolbar).not.toBeVisible()
  })

  test('Save button directly saves for previously saved workflow', async ({
    comfyPage
  }) => {
    const { footer, saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)

    await builderSaveAs(comfyPage.appMode, `${Date.now()} direct-save`, 'App')
    await saveAs.closeButton.click()
    await comfyPage.nextFrame()

    // Modify the workflow so the save button becomes enabled
    await comfyPage.appMode.steps.goToInputs()
    await comfyPage.appMode.select.deleteInput('seed')
    await expect(footer.saveButton).toBeEnabled({ timeout: 5000 })

    await footer.saveButton.click()
    await comfyPage.nextFrame()

    await expect(saveAs.dialog).not.toBeVisible({ timeout: 2000 })
    await expect(footer.saveButton).toBeDisabled()
  })

  test('Split button chevron opens save-as for saved workflow', async ({
    comfyPage
  }) => {
    const { footer, saveAs } = comfyPage.appMode
    await setupBuilder(comfyPage)

    await builderSaveAs(comfyPage.appMode, `${Date.now()} split-btn`, 'App')
    await saveAs.closeButton.click()
    await comfyPage.nextFrame()

    await footer.openSaveAsFromChevron()

    await expect(saveAs.title).toBeVisible({ timeout: 5000 })
    await expect(saveAs.nameInput).toBeVisible()
  })

  test('Save button width is consistent across all states', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await comfyPage.workflow.loadWorkflow('default')
    await fitToViewInstant(comfyPage)
    await appMode.enterBuilder()

    // State 1: Disabled "Save as" (no outputs selected)
    const disabledBox = await appMode.footer.saveAsButton.boundingBox()
    expect(disabledBox).toBeTruthy()

    // Select I/O to enable the button
    await appMode.steps.goToInputs()
    await appMode.select.selectInputWidget('KSampler', 'seed')
    await appMode.steps.goToOutputs()
    await appMode.select.selectOutputNode('Save Image')

    // State 2: Enabled "Save as" (unsaved, has outputs)
    const enabledBox = await appMode.footer.saveAsButton.boundingBox()
    expect(enabledBox).toBeTruthy()
    expect(enabledBox!.width).toBe(disabledBox!.width)

    // Save the workflow to transition to the Save + chevron state
    await builderSaveAs(appMode, `${Date.now()} width-test`, 'App')
    await appMode.saveAs.closeButton.click()
    await comfyPage.nextFrame()

    // State 3: Save + chevron button group (saved workflow)
    const saveButtonGroupBox = await appMode.footer.saveGroup.boundingBox()
    expect(saveButtonGroupBox).toBeTruthy()
    expect(saveButtonGroupBox!.width).toBe(disabledBox!.width)
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
    ).toBeVisible({ timeout: 5000 })
  })

  test('save as app produces correct extension and linearMode', async ({
    comfyPage
  }) => {
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, `${Date.now()} app-ext`, 'App')

    const path = await comfyPage.workflow.getActiveWorkflowPath()
    expect(path).toContain('.app.json')

    const linearMode = await comfyPage.workflow.getLinearModeFromGraph()
    expect(linearMode).toBe(true)
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

    const path = await comfyPage.workflow.getActiveWorkflowPath()
    expect(path).toMatch(/\.json$/)
    expect(path).not.toContain('.app.json')

    const linearMode = await comfyPage.workflow.getLinearModeFromGraph()
    expect(linearMode).toBe(false)
  })

  test('save as app View App button enters app mode', async ({ comfyPage }) => {
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, `${Date.now()} app-view`, 'App')

    await comfyPage.appMode.saveAs.viewAppButton.click()
    await comfyPage.nextFrame()

    expect(await comfyPage.workflow.getActiveWorkflowActiveAppMode()).toBe(
      'app'
    )
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
    await comfyPage.nextFrame()

    await expect(comfyPage.appMode.steps.toolbar).not.toBeVisible()
  })

  test('save as with different mode does not modify the original workflow', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage)

    const originalName = `${Date.now()} original`
    await builderSaveAs(appMode, originalName, 'App')
    const originalPath = await comfyPage.workflow.getActiveWorkflowPath()
    expect(originalPath).toContain('.app.json')
    await appMode.saveAs.closeButton.click()
    await comfyPage.nextFrame()

    // Re-save as node graph — creates a copy
    await reSaveAs(appMode, `${Date.now()} copy`, 'Node graph')
    await expect(appMode.saveAs.successMessage).toBeVisible({ timeout: 5000 })

    const newPath = await comfyPage.workflow.getActiveWorkflowPath()
    expect(newPath).not.toBe(originalPath)
    expect(newPath).not.toContain('.app.json')

    // Dismiss success dialog, exit app mode, reopen the original
    await appMode.saveAs.dismissButton.click()
    await comfyPage.nextFrame()
    await appMode.toggleAppMode()
    await openWorkflowFromSidebar(comfyPage, originalName)

    const linearMode = await comfyPage.workflow.getLinearModeFromGraph()
    expect(linearMode).toBe(true)
  })

  test('save as with same name and same mode overwrites in place', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const name = `${Date.now()} overwrite`
    await setupBuilder(comfyPage)

    await builderSaveAs(appMode, name, 'App')
    await appMode.saveAs.closeButton.click()
    await comfyPage.nextFrame()

    const pathAfterFirst = await comfyPage.workflow.getActiveWorkflowPath()

    await reSaveAs(appMode, name, 'App')

    await expect(appMode.saveAs.overwriteDialog).toBeVisible({ timeout: 5000 })
    await appMode.saveAs.overwriteButton.click()

    await expect(appMode.saveAs.successMessage).toBeVisible({ timeout: 5000 })

    const pathAfterSecond = await comfyPage.workflow.getActiveWorkflowPath()
    expect(pathAfterSecond).toBe(pathAfterFirst)
  })

  test('save as with same name but different mode creates a new file', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const name = `${Date.now()} mode-change`
    await setupBuilder(comfyPage)

    await builderSaveAs(appMode, name, 'App')
    const pathAfterFirst = await comfyPage.workflow.getActiveWorkflowPath()
    expect(pathAfterFirst).toContain('.app.json')
    await appMode.saveAs.closeButton.click()
    await comfyPage.nextFrame()

    await reSaveAs(appMode, name, 'Node graph')
    await expect(appMode.saveAs.successMessage).toBeVisible({ timeout: 5000 })

    const pathAfterSecond = await comfyPage.workflow.getActiveWorkflowPath()
    expect(pathAfterSecond).not.toBe(pathAfterFirst)
    expect(pathAfterSecond).toMatch(/\.json$/)
    expect(pathAfterSecond).not.toContain('.app.json')
  })

  test('save as app workflow reloads in app mode', async ({ comfyPage }) => {
    const name = `${Date.now()} reload-app`
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, name, 'App')
    await comfyPage.appMode.saveAs.dismissButton.click()
    await comfyPage.nextFrame()
    await comfyPage.appMode.footer.exitBuilder()

    await openWorkflowFromSidebar(comfyPage, name)

    const mode = await comfyPage.workflow.getActiveWorkflowInitialMode()
    expect(mode).toBe('app')
  })

  test('save as node graph workflow reloads in node graph mode', async ({
    comfyPage
  }) => {
    const name = `${Date.now()} reload-graph`
    await setupBuilder(comfyPage)
    await builderSaveAs(comfyPage.appMode, name, 'Node graph')
    await comfyPage.appMode.saveAs.dismissButton.click()
    await comfyPage.nextFrame()
    await comfyPage.appMode.toggleAppMode()

    await openWorkflowFromSidebar(comfyPage, name)

    const mode = await comfyPage.workflow.getActiveWorkflowInitialMode()
    expect(mode).toBe('graph')
  })
})
