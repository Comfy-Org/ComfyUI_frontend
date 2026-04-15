import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { AppModeHelper } from '@e2e/fixtures/helpers/AppModeHelper'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  builderSaveAs,
  openWorkflowFromSidebar,
  setupBuilder
} from '@e2e/helpers/builderTestUtils'

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
  await expect(appMode.saveAs.successDialog).toBeHidden()

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

    await expect(appMode.linearWidgets).toBeVisible()
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

    await expect(appMode.linearWidgets).toBeVisible()
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
    const app2Widgets = ['seed', 'steps']
    const app1Reordered = ['steps', 'cfg', 'seed']

    await test.step('Load both apps', async () => {
      await comfyPage.workflow.loadWorkflow('linear-basic-app-1')
      await comfyPage.workflow.loadWorkflow('linear-basic-app-2')
    })

    await test.step('Reorder app1 inputs', async () => {
      await comfyPage.workflow.switchToTab('linear-basic-app-1')
      await appMode.enterBuilder()
      await appMode.steps.goToInputs()
      await expect(appMode.select.inputItemTitles).toHaveText(WIDGETS)

      await appMode.select.dragInputItem(0, 2)
      await expect(appMode.select.inputItemTitles).toHaveText(app1Reordered)
    })

    await test.step('Verify app2 inputs are not corrupted', async () => {
      await appMode.footer.exitBuilder()
      await comfyPage.workflow.switchToTab('linear-basic-app-2')
      await appMode.enterBuilder()
      await appMode.steps.goToInputs()
      await expect(appMode.select.inputItemTitles).toHaveText(app2Widgets)
    })

    await test.step('Verify app1 reorder persisted', async () => {
      await appMode.footer.exitBuilder()
      await comfyPage.workflow.switchToTab('linear-basic-app-1')
      await appMode.enterBuilder()
      await appMode.steps.goToInputs()
      await expect(appMode.select.inputItemTitles).toHaveText(app1Reordered)
    })
  })
})
