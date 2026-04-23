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

async function saveCloseAndReopenInBuilder(
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
  await appMode.enterBuilder()
  await appMode.steps.goToInputs()
}

test.describe(
  'App builder input persistence after reload',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.appMode.enableLinearMode()
      await comfyPage.settings.setSetting(
        'Comfy.AppBuilder.VueNodeSwitchDismissed',
        true
      )
    })

    test('persists selected inputs after save and reopen without visibility errors', async ({
      comfyPage
    }) => {
      const { appMode } = comfyPage
      await setupBuilder(comfyPage, undefined, WIDGETS)

      await appMode.steps.goToInputs()
      await expect(appMode.select.inputItemTitles).toHaveText(WIDGETS)

      const workflowName = `${Date.now()} input-persistence`
      await saveCloseAndReopenInBuilder(comfyPage, appMode, workflowName)

      await expect(appMode.select.inputItemTitles).toHaveText(WIDGETS)
      for (const widget of WIDGETS) {
        await expect(
          appMode.select.getInputItemSubtitle(widget)
        ).not.toContainText('Widget not visible')
      }
    })
  }
)
