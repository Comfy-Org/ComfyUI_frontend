import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { queuedExecutionFixture as test } from '@e2e/fixtures/queuedExecutionFixture'

const SAVE_IMAGE_NODE = '9'
const KSAMPLER_NODE = '3'

function imageOutput(filename: string) {
  return {
    images: [{ filename, subfolder: '', type: 'output' }]
  }
}

test.describe('App mode save keeps run history', { tag: '@ui' }, () => {
  test.use({
    initialSettings: { 'Comfy.AppBuilder.VueNodeSwitchDismissed': true }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.appMode.enterAppModeWithInputs([[KSAMPLER_NODE, 'seed']])
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
  })

  test('first save as app does not clear previously generated outputs', async ({
    comfyPage,
    queuedExecution
  }) => {
    const job = await queuedExecution.capture(() =>
      comfyPage.appMode.runButton.click()
    )
    job.start()

    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    job.output(SAVE_IMAGE_NODE, imageOutput('persist-output.png'))

    await expect(
      comfyPage.appMode.outputHistory.imageOutputs.first()
    ).toBeVisible()

    await comfyPage.appMode.enterBuilder()
    await expect(comfyPage.appMode.steps.toolbar).toBeVisible()

    await comfyPage.appMode.footer.saveAsButton.click()
    await expect(comfyPage.appMode.saveAs.nameInput).toBeVisible()
    await comfyPage.appMode.saveAs.fillAndSave(
      `${Date.now()} run-history-persist`,
      'App'
    )
    await expect(comfyPage.appMode.saveAs.successMessage).toBeVisible()

    await comfyPage.appMode.saveAs.viewAppButton.click()
    await expect(comfyPage.appMode.saveAs.successDialog).toBeHidden()
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()

    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()
    await expect(
      comfyPage.appMode.outputHistory.imageOutputs.first()
    ).toBeVisible()
  })
})
