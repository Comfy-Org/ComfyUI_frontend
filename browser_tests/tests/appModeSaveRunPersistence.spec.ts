import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const SAVE_IMAGE_NODE = '9'
const KSAMPLER_NODE = '3'

async function startExecution(comfyPage: ComfyPage, exec: ExecutionHelper) {
  const jobId = await exec.run()
  await comfyPage.nextFrame()
  exec.executionStart(jobId)
  return jobId
}

function imageOutput(filename: string) {
  return {
    images: [{ filename, subfolder: '', type: 'output' }]
  }
}

test.describe('App mode save keeps run history', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.appMode.suppressVueNodeSwitchPopup()
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.appMode.enterAppModeWithInputs([[KSAMPLER_NODE, 'seed']])
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
  })

  test('first save as app does not clear previously generated outputs', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    const exec = new ExecutionHelper(comfyPage, ws)
    const jobId = await startExecution(comfyPage, exec)

    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('persist-output.png'))

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
