import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'
import type { AppModeHelper } from '../fixtures/helpers/AppModeHelper'
import {
  builderSaveAs,
  createAndSaveApp,
  openWorkflowFromSidebar,
  setupBuilder
} from '../helpers/builderTestUtils'

const WIDGETS = ['seed', 'steps', 'cfg']

/** Save as app, close it by loading default, reopen from sidebar, enter app mode. */
async function saveCloseAndReopenAsApp(
  comfyPage: ComfyPage,
  appMode: AppModeHelper,
  workflowName: string
) {
  await appMode.steps.goToPreview()
  await builderSaveAs(appMode, workflowName)
  await appMode.saveAs.closeButton.click()
  await comfyPage.nextFrame()

  await appMode.footer.exitBuilder()
  await openWorkflowFromSidebar(comfyPage, workflowName)
  await appMode.toggleAppMode()
}

test.describe('Builder input reordering', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.settings.setSetting(
      'Comfy.AppBuilder.VueNodeSwitchDismissed',
      true
    )
  })

  test('Drag first input to last position', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage, undefined, WIDGETS)

    await appMode.steps.goToInputs()
    await expect(appMode.select.inputItemTitles).toHaveText(WIDGETS)

    await appMode.select.dragInputItem(0, 2)
    await expect(appMode.select.inputItemTitles).toHaveText([
      'steps',
      'cfg',
      'seed'
    ])

    await appMode.steps.goToPreview()
    await expect(appMode.select.previewWidgetLabels).toHaveText([
      'steps',
      'cfg',
      'seed'
    ])
  })

  test('Drag last input to first position', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage, undefined, WIDGETS)

    await appMode.steps.goToInputs()
    await expect(appMode.select.inputItemTitles).toHaveText(WIDGETS)

    await appMode.select.dragInputItem(2, 0)
    await expect(appMode.select.inputItemTitles).toHaveText([
      'cfg',
      'seed',
      'steps'
    ])

    await appMode.steps.goToPreview()
    await expect(appMode.select.previewWidgetLabels).toHaveText([
      'cfg',
      'seed',
      'steps'
    ])
  })

  test('Drag input to middle position', async ({ comfyPage }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage, undefined, WIDGETS)

    await appMode.steps.goToInputs()
    await expect(appMode.select.inputItemTitles).toHaveText(WIDGETS)

    await appMode.select.dragInputItem(0, 1)
    await expect(appMode.select.inputItemTitles).toHaveText([
      'steps',
      'seed',
      'cfg'
    ])

    await appMode.steps.goToPreview()
    await expect(appMode.select.previewWidgetLabels).toHaveText([
      'steps',
      'seed',
      'cfg'
    ])
  })

  test('Reorder in preview step reflects in app mode after save', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage, undefined, WIDGETS)

    await appMode.steps.goToPreview()
    await expect(appMode.select.previewWidgetLabels).toHaveText(WIDGETS)

    await appMode.select.dragPreviewItem(0, 2)
    await expect(appMode.select.previewWidgetLabels).toHaveText([
      'steps',
      'cfg',
      'seed'
    ])

    const workflowName = `${Date.now()} reorder-preview`
    await saveCloseAndReopenAsApp(comfyPage, appMode, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.select.previewWidgetLabels).toHaveText([
      'steps',
      'cfg',
      'seed'
    ])
  })

  test('Reorder inputs persists after save and reload', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    await setupBuilder(comfyPage, undefined, WIDGETS)

    await appMode.steps.goToInputs()
    await appMode.select.dragInputItem(0, 2)
    await expect(appMode.select.inputItemTitles).toHaveText([
      'steps',
      'cfg',
      'seed'
    ])

    const workflowName = `${Date.now()} reorder-persist`
    await saveCloseAndReopenAsApp(comfyPage, appMode, workflowName)

    await expect(appMode.linearWidgets).toBeVisible({ timeout: 5000 })
    await expect(appMode.select.previewWidgetLabels).toHaveText([
      'steps',
      'cfg',
      'seed'
    ])
  })

  test('Reordering inputs in one app does not corrupt another app', async ({
    comfyPage
  }) => {
    const { appMode } = comfyPage
    const suffix = String(Date.now())
    const app1Name = `app1-${suffix}`
    const app2Name = `app2-${suffix}`
    const app2Widgets = ['seed', 'steps']

    // Create and save app1 with [seed, steps, cfg]
    await createAndSaveApp(comfyPage, app1Name, WIDGETS)
    await appMode.footer.exitBuilder()

    // Create app2 in a new tab so both apps are open simultaneously
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await createAndSaveApp(comfyPage, app2Name, app2Widgets)
    await appMode.footer.exitBuilder()

    // Switch to app1 tab and enter builder
    await comfyPage.menu.topbar.getWorkflowTab(app1Name).click()
    await appMode.enterBuilder()
    await appMode.steps.goToInputs()
    await expect(appMode.select.inputItemTitles).toHaveText(WIDGETS)

    // Reorder app1 inputs: drag 'seed' from first to last
    await appMode.select.dragInputItem(0, 2)
    const app1Reordered = ['steps', 'cfg', 'seed']
    await expect(appMode.select.inputItemTitles).toHaveText(app1Reordered)

    // Switch to app2 tab and enter builder
    await appMode.footer.exitBuilder()
    await comfyPage.menu.topbar.getWorkflowTab(app2Name).click()
    await appMode.enterBuilder()
    await appMode.steps.goToInputs()

    // Verify app2 inputs are not corrupted — still [seed, steps]
    await expect(appMode.select.inputItemTitles).toHaveText(app2Widgets)

    // Switch back to app1 and verify reorder persisted
    await appMode.footer.exitBuilder()
    await comfyPage.menu.topbar.getWorkflowTab(app1Name).click()
    await appMode.enterBuilder()
    await appMode.steps.goToInputs()

    await expect(appMode.select.inputItemTitles).toHaveText(app1Reordered)
  })
})
