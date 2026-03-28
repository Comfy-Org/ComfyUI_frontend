import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'
import type { AppModeHelper } from '../fixtures/helpers/AppModeHelper'
import {
  builderSaveAs,
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

test.describe('Builder input/output reorder', { tag: '@ui' }, () => {
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
})
