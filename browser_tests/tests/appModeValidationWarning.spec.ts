import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { NodeError } from '@/schemas/apiSchema'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { enableErrorsOverlay } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const SAVE_IMAGE_NODE_ID = '9'

function buildSaveImageRequiredInputError(): NodeError {
  return {
    class_type: 'SaveImage',
    dependent_outputs: [],
    errors: [
      {
        type: 'required_input_missing',
        message: 'Required input is missing: images',
        details: '',
        extra_info: { input_name: 'images' }
      }
    ]
  }
}

test.describe(
  'App mode validation warning',
  { tag: ['@ui', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await enableErrorsOverlay(comfyPage)
      await comfyPage.workflow.loadWorkflow('linear-validation-warning')
      await comfyPage.appMode.toggleAppMode()
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    })

    test('opens graph errors from the app mode validation warning', async ({
      comfyPage
    }) => {
      await expect(comfyPage.appMode.validationWarning).toBeHidden()

      const exec = new ExecutionHelper(comfyPage)
      await exec.mockValidationFailure({
        [SAVE_IMAGE_NODE_ID]: buildSaveImageRequiredInputError()
      })

      await comfyPage.appMode.runButton.click()
      const appModeOverlay = comfyPage.appMode.centerPanel.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(appModeOverlay).toBeVisible()
      await appModeOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()
      await expect(appModeOverlay).toBeHidden()

      await expect(comfyPage.appMode.validationWarning).toBeVisible()
      await expect(comfyPage.appMode.validationWarning).toContainText(
        /Workflow has errors/i
      )
      await expect(comfyPage.appMode.viewErrorsInGraphButton).toBeVisible()

      await comfyPage.appMode.viewErrorsInGraphButton.click()

      await expect(comfyPage.appMode.linearWidgets).toBeHidden()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.root)
      ).toBeVisible()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.errorsTab)
      ).toBeVisible()
    })
  }
)
