import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

wstest.describe('Docked actionbar run progress bar', { tag: ['@ui'] }, () => {
  wstest.use({
    initialSettings: {
      'Comfy.Queue.QPOV2': true,
      'Comfy.Queue.ShowRunProgressBar': true
    }
  })

  wstest(
    'stays flush with the actionbar bottom while a job runs',
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      const jobId = await execution.run()
      execution.executionStart(jobId)
      execution.nodeRunning(jobId, '3', 13, 20)

      await expect(comfyPage.actionbar.inlineProgressNodeFill).toBeVisible()
      await comfyPage.actionbar.expectInlineProgressFlushWithCardBottom()
      await comfyPage.actionbar.expectInlineProgressClearOfControls()
    }
  )

  wstest(
    'grows with reported progress and clears when the job ends',
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const fill = comfyPage.actionbar.inlineProgressNodeFill

      const jobId = await execution.run()
      execution.executionStart(jobId)
      execution.nodeRunning(jobId, '3', 5, 20)

      await expect(fill).toHaveAttribute('style', 'width: 25%;')

      execution.nodeRunning(jobId, '3', 18, 20)
      await expect(fill).toHaveAttribute('style', 'width: 90%;')
      await comfyPage.actionbar.expectInlineProgressFlushWithCardBottom()

      execution.executionSuccess(jobId)
      await expect(comfyPage.actionbar.inlineProgress).toBeHidden()
    }
  )
})
