import type { WebSocketRoute } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

const test = mergeTests(comfyPageFixture, webSocketFixture)

// Node IDs from the default workflow (browser_tests/assets/default.json, 7 nodes)
const SAVE_IMAGE_NODE = '9'
const KSAMPLER_NODE = '3'
const ALL_NODE_IDS = ['4', '6', '7', '5', KSAMPLER_NODE, '8', SAVE_IMAGE_NODE]
// Node ID from execution/image_compare_save.json
const IMAGE_COMPARE_NODE = '10'

/** Queue a prompt, intercept it, and send execution_start. */
async function startExecution(
  comfyPage: ComfyPage,
  ws: WebSocketRoute,
  exec?: ExecutionHelper
) {
  exec ??= new ExecutionHelper(comfyPage, ws)
  const jobId = await exec.run()
  // Allow storeJob() to complete before sending WS events
  await comfyPage.nextFrame()
  exec.executionStart(jobId)
  return { exec, jobId }
}

function imageOutput(...filenames: string[]) {
  return {
    images: filenames.map((filename) => ({
      filename,
      subfolder: '',
      type: 'output'
    }))
  }
}

test.describe('Output History', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.describe('Default workflow', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.appMode.enterAppModeWithInputs([[KSAMPLER_NODE, 'seed']])
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()
      await comfyPage.nextFrame()
    })

    test('Skeleton appears on execution start', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      await startExecution(comfyPage, ws)

      await expect(
        comfyPage.appMode.outputHistory.skeletons.first()
      ).toBeVisible()
    })

    test('Latent preview replaces skeleton', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      await expect(
        comfyPage.appMode.outputHistory.skeletons.first()
      ).toBeVisible()

      exec.latentPreview(jobId, SAVE_IMAGE_NODE)

      await expect(
        comfyPage.appMode.outputHistory.latentPreviews.first()
      ).toBeVisible()
      await expect(comfyPage.appMode.outputHistory.skeletons).toHaveCount(0)
    })

    test('Image output replaces skeleton on executed', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      await expect(
        comfyPage.appMode.outputHistory.inProgressItems.first()
      ).toBeVisible()

      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('test_output.png'))

      await expect(
        comfyPage.appMode.outputHistory.imageOutputs.first()
      ).toBeVisible()
      await expect(comfyPage.appMode.outputHistory.skeletons).toHaveCount(0)
    })

    test('Multiple outputs from single execution', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      await expect(
        comfyPage.appMode.outputHistory.inProgressItems.first()
      ).toBeVisible()

      exec.executed(
        jobId,
        SAVE_IMAGE_NODE,
        imageOutput('output_001.png', 'output_002.png', 'output_003.png')
      )

      await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(3)
    })

    test('Video output renders video element', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      await expect(
        comfyPage.appMode.outputHistory.inProgressItems.first()
      ).toBeVisible()

      exec.executed(jobId, SAVE_IMAGE_NODE, {
        gifs: [{ filename: 'output.mp4', subfolder: '', type: 'output' }]
      })

      await expect(
        comfyPage.appMode.outputHistory.videoOutputs.first()
      ).toBeVisible()
    })

    test('Cancel button sends interrupt during execution', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      const job: RawJobListItem = {
        id: jobId,
        status: 'in_progress',
        create_time: Date.now() / 1000,
        priority: 0
      }
      await comfyPage.page.route(
        /\/api\/jobs\?status=in_progress/,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jobs: [job],
              pagination: { offset: 0, limit: 200, total: 1, has_more: false }
            })
          })
        },
        { times: 1 }
      )
      // Trigger queue refresh
      exec.status(1)
      await comfyPage.nextFrame()

      await expect(comfyPage.appMode.cancelRunButton).toBeVisible()

      await comfyPage.page.route('**/interrupt', (route) =>
        route.fulfill({ status: 200 })
      )
      const interruptRequest = comfyPage.page.waitForRequest('**/interrupt')
      await comfyPage.appMode.cancelRunButton.click()
      await interruptRequest
    })

    test('Full execution lifecycle cleans up in-progress items', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      // Skeleton appears
      await expect(
        comfyPage.appMode.outputHistory.skeletons.first()
      ).toBeVisible()

      // Latent preview replaces skeleton
      exec.latentPreview(jobId, SAVE_IMAGE_NODE)
      await expect(
        comfyPage.appMode.outputHistory.latentPreviews.first()
      ).toBeVisible()

      // Image output replaces latent
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('lifecycle_out.png'))
      await expect(
        comfyPage.appMode.outputHistory.imageOutputs.first()
      ).toBeVisible()

      // Job completes with history mock - in-progress items fully resolved
      await exec.completeWithHistory(
        jobId,
        SAVE_IMAGE_NODE,
        'lifecycle_out.png'
      )

      await expect(comfyPage.appMode.outputHistory.inProgressItems).toHaveCount(
        0
      )
      // Output now appears as a history item
      await expect(
        comfyPage.appMode.outputHistory.historyItems.first()
      ).toBeVisible()
    })

    test('Auto-selection follows latest in-progress item', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      // Skeleton is auto-selected
      await expect(
        comfyPage.appMode.outputHistory.selectedInProgressItem
      ).toBeVisible()

      // First image is auto-selected
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('first.png'))
      await expect(
        comfyPage.appMode.outputHistory.selectedInProgressItem.getByTestId(
          'linear-image-output'
        )
      ).toHaveAttribute('src', /first\.png/)

      // Second image arrives - selection auto-follows without user click
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('second.png'))
      await expect(
        comfyPage.appMode.outputHistory.selectedInProgressItem.getByTestId(
          'linear-image-output'
        )
      ).toHaveAttribute('src', /second\.png/)
    })

    test('In-progress items always auto-follow to latest output', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      // Send first image
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('first.png'))
      await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)

      // Click the first in-progress image
      await comfyPage.appMode.outputHistory.inProgressItems.first().click()

      // Send second image - selection should follow because slot items
      // always auto-follow to keep the user on the latest output
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('second.png'))
      await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(2)

      await expect(
        comfyPage.appMode.outputHistory.selectedInProgressItem.getByTestId(
          'linear-image-output'
        )
      ).toHaveAttribute('src', /second\.png/)
    })

    test('Non-output node executed events are filtered', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      await expect(
        comfyPage.appMode.outputHistory.inProgressItems.first()
      ).toBeVisible()

      // KSampler is not an output node - should be filtered
      exec.executed(jobId, KSAMPLER_NODE, imageOutput('ksampler_out.png'))
      await comfyPage.nextFrame()

      // KSampler output should not create image outputs
      await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(0)

      // Now send from the actual output node (SaveImage)
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('save_image_out.png'))
      await expect(
        comfyPage.appMode.outputHistory.imageOutputs.first()
      ).toBeVisible()
    })

    test('In-progress items are outside the scrollable area', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()

      // Complete one execution with 100 image outputs
      const { exec, jobId } = await startExecution(comfyPage, ws)
      exec.executed(
        jobId,
        SAVE_IMAGE_NODE,
        imageOutput(
          ...Array.from(
            { length: 100 },
            (_, i) => `image_${String(i).padStart(3, '0')}.png`
          )
        )
      )
      await exec.completeWithHistory(jobId, SAVE_IMAGE_NODE, 'image_000.png')

      await expect(comfyPage.appMode.outputHistory.historyItems).toHaveCount(
        100
      )

      // First history item is visible before scrolling
      const firstItem = comfyPage.appMode.outputHistory.historyItems.first()
      await expect(firstItem).toBeInViewport()

      // Scroll the history feed all the way to the right
      await comfyPage.appMode.outputHistory.outputs.evaluate((el) => {
        el.scrollLeft = el.scrollWidth
      })

      // First history item is now off-screen
      await expect(firstItem).not.toBeInViewport()

      // Start a new execution to get an in-progress item
      await startExecution(comfyPage, ws, exec)

      // In-progress item is visible despite scrolling
      await expect(
        comfyPage.appMode.outputHistory.inProgressItems.first()
      ).toBeInViewport()
    })

    test('Execution error cleans up in-progress items', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      await expect(
        comfyPage.appMode.outputHistory.inProgressItems.first()
      ).toBeVisible()

      exec.executionError(jobId, KSAMPLER_NODE, 'Test error')

      await expect(comfyPage.appMode.outputHistory.inProgressItems).toHaveCount(
        0
      )
    })

    test('Progress bars update for both node and overall progress', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      const {
        inProgressItems,
        headerOverallProgress,
        headerNodeProgress,
        itemOverallProgress,
        itemNodeProgress
      } = comfyPage.appMode.outputHistory

      await expect(inProgressItems.first()).toBeVisible()

      // Initially both bars are at 0%
      await expect(headerOverallProgress).toHaveAttribute(
        'style',
        /width:\s*0%/
      )
      await expect(headerNodeProgress).toHaveAttribute('style', /width:\s*0%/)

      // KSampler starts executing - node progress at 50%
      exec.executing(jobId, KSAMPLER_NODE)
      exec.progress(jobId, KSAMPLER_NODE, 5, 10)

      await expect(headerNodeProgress).toHaveAttribute('style', /width:\s*50%/)
      await expect(itemNodeProgress).toHaveAttribute('style', /width:\s*50%/)
      // Overall still 0% - no nodes completed yet
      await expect(headerOverallProgress).toHaveAttribute(
        'style',
        /width:\s*0%/
      )

      // KSampler finishes - overall advances (1 of 7 nodes)
      exec.executed(jobId, KSAMPLER_NODE, {})

      const oneNodePercent = Math.round((1 / ALL_NODE_IDS.length) * 100)
      const pct = new RegExp(`width:\\s*${oneNodePercent}%`)
      await expect(headerOverallProgress).toHaveAttribute('style', pct)
      await expect(itemOverallProgress).toHaveAttribute('style', pct)

      // Node progress reaches 100%
      exec.progress(jobId, KSAMPLER_NODE, 10, 10)

      await expect(headerNodeProgress).toHaveAttribute('style', /width:\s*100%/)
      await expect(itemNodeProgress).toHaveAttribute('style', /width:\s*100%/)

      // Complete remaining nodes - overall reaches 100%
      const remainingNodes = ALL_NODE_IDS.filter((id) => id !== KSAMPLER_NODE)
      for (const nodeId of remainingNodes) {
        exec.executing(jobId, nodeId)
        exec.executed(jobId, nodeId, {})
      }

      await expect(headerOverallProgress).toHaveAttribute(
        'style',
        /width:\s*100%/
      )
      await expect(itemOverallProgress).toHaveAttribute(
        'style',
        /width:\s*100%/
      )
    })
  })

  test.describe('Image Compare', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('execution/image_compare_save')
      await comfyPage.appMode.enterAppModeWithInputs(
        [[KSAMPLER_NODE, 'seed']],
        [SAVE_IMAGE_NODE, IMAGE_COMPARE_NODE]
      )
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()
      await comfyPage.nextFrame()
    })

    /** Run a complete compare + save execution lifecycle. */
    async function runCompareExecution(
      exec: ExecutionHelper,
      comfyPage: ComfyPage,
      idx: string,
      savedFilename: string
    ) {
      const jobId = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId)
      exec.executedImageCompare(
        jobId,
        IMAGE_COMPARE_NODE,
        [`before${idx}.png`],
        [`after${idx}.png`]
      )
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput(savedFilename))
      await exec.completeWithHistory(jobId, SAVE_IMAGE_NODE, savedFilename)
    }

    /** Run two executions that each produce a compare + image output. */
    async function runTwoCompareExecutions(
      exec: ExecutionHelper,
      comfyPage: ComfyPage
    ) {
      await runCompareExecution(exec, comfyPage, '1', 'saved1.png')
      await runCompareExecution(exec, comfyPage, '2', 'saved2.png')
    }

    test('Split thumbnail and slider preview', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      exec.executedImageCompare(
        jobId,
        IMAGE_COMPARE_NODE,
        ['before.png'],
        ['after.png']
      )

      // Split thumbnail appears in the output strip
      await expect(
        comfyPage.appMode.outputHistory.compareOutputs.first()
      ).toBeVisible()

      // Auto-selected - full preview with slider is shown
      await expect(comfyPage.appMode.outputHistory.comparePreview).toBeVisible()
      await expect(comfyPage.appMode.outputHistory.compareSlider).toBeVisible()

      // Single image per side - no batch navigation
      await expect(comfyPage.appMode.outputHistory.batchNav).toHaveCount(0)
    })

    test('Slider moves on pointer interaction', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      exec.executedImageCompare(
        jobId,
        IMAGE_COMPARE_NODE,
        ['before.png'],
        ['after.png']
      )

      const preview = comfyPage.appMode.outputHistory.comparePreview
      await expect(preview).toBeVisible()

      // Slider starts at 50%
      const slider = comfyPage.appMode.outputHistory.compareSlider
      await expect(slider).toHaveAttribute('style', /left:\s*50%/)

      // Move pointer to the left quarter of the preview
      const box = await preview.boundingBox()
      expect(box).toBeTruthy()
      await comfyPage.page.mouse.move(
        box!.x + box!.width * 0.25,
        box!.y + box!.height / 2
      )

      // Slider should move to ~25%
      await expect(slider).toHaveAttribute('style', /left:\s*2[0-9](\.\d+)?%/)
    })

    test('Single-sided compare renders without slider', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      exec.executed(jobId, IMAGE_COMPARE_NODE, {
        a_images: [{ filename: 'before.png', subfolder: '', type: 'output' }]
      })

      await expect(
        comfyPage.appMode.outputHistory.compareOutputs.first()
      ).toBeVisible()
      await expect(comfyPage.appMode.outputHistory.compareSlider).toHaveCount(0)
    })

    test('Compare output becomes non-asset after completion', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      exec.executedImageCompare(
        jobId,
        IMAGE_COMPARE_NODE,
        ['before.png'],
        ['after.png']
      )
      exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('saved.png'))

      // Both visible as in-progress
      await expect(comfyPage.appMode.outputHistory.inProgressItems).toHaveCount(
        2
      )
      await expect(comfyPage.appMode.outputHistory.compareOutputs).toHaveCount(
        1
      )
      await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)

      // After completion: compare → non-asset, image → history
      await exec.completeWithHistory(jobId, SAVE_IMAGE_NODE, 'saved.png')

      await expect(comfyPage.appMode.outputHistory.inProgressItems).toHaveCount(
        0
      )
      await expect(comfyPage.appMode.outputHistory.nonAssetItems).toHaveCount(1)
      await expect(
        comfyPage.appMode.outputHistory.nonAssetItems
          .first()
          .getByTestId('linear-compare-output')
      ).toBeVisible()
    })

    test('Compare output persists when no SaveImage node exists', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.workflow.loadWorkflow('execution/image_compare_only')
      await comfyPage.appMode.enterAppModeWithInputs(
        [[KSAMPLER_NODE, 'seed']],
        [IMAGE_COMPARE_NODE]
      )
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()
      await comfyPage.nextFrame()

      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      exec.executedImageCompare(
        jobId,
        IMAGE_COMPARE_NODE,
        ['before.png'],
        ['after.png']
      )

      await expect(
        comfyPage.appMode.outputHistory.compareOutputs.first()
      ).toBeVisible()

      exec.executionSuccess(jobId)
      exec.status(0)
      await comfyPage.nextFrame()

      await expect(comfyPage.appMode.outputHistory.nonAssetItems).toHaveCount(1)
    })

    test('Multiple executions accumulate non-asset outputs', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)

      await runTwoCompareExecutions(exec, comfyPage)

      await expect(comfyPage.appMode.outputHistory.nonAssetItems).toHaveCount(2)
    })

    test('Latest non-asset auto-follows to new execution', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)

      const jobId1 = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId1)
      exec.executedImageCompare(
        jobId1,
        IMAGE_COMPARE_NODE,
        ['before.png'],
        ['after.png']
      )
      exec.executed(jobId1, SAVE_IMAGE_NODE, imageOutput('saved.png'))
      await exec.completeWithHistory(jobId1, SAVE_IMAGE_NODE, 'saved.png')

      // Latest non-asset should be auto-selected
      await expect(
        comfyPage.appMode.outputHistory.selectedNonAssetItem
      ).toBeVisible()

      // New execution - auto-follow kicks in
      await startExecution(comfyPage, ws, exec)

      await expect(
        comfyPage.appMode.outputHistory.selectedInProgressItem
      ).toBeVisible()
      await expect(
        comfyPage.appMode.outputHistory.selectedNonAssetItem
      ).toHaveCount(0)
    })

    test('Older non-asset keeps selection when new execution produces compare output', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)

      await runTwoCompareExecutions(exec, comfyPage)

      // Click the older (last) non-asset
      await comfyPage.appMode.outputHistory.nonAssetItems.last().click()
      await expect(
        comfyPage.appMode.outputHistory.selectedNonAssetItem
      ).toBeVisible()

      // New execution - selection should NOT move
      const { jobId: jobId3 } = await startExecution(comfyPage, ws, exec)
      exec.executedImageCompare(
        jobId3,
        IMAGE_COMPARE_NODE,
        ['before3.png'],
        ['after3.png']
      )
      await comfyPage.nextFrame()

      await expect(
        comfyPage.appMode.outputHistory.selectedNonAssetItem
      ).toBeVisible()
    })

    test('Older non-asset keeps selection when new execution completes with history', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)

      await runTwoCompareExecutions(exec, comfyPage)

      // Select the older non-asset
      await comfyPage.appMode.outputHistory.nonAssetItems.last().click()
      await expect(
        comfyPage.appMode.outputHistory.selectedNonAssetItem
      ).toBeVisible()

      // New run adds history - selection should NOT move
      const jobId3 = await exec.run()
      await comfyPage.nextFrame()
      exec.executionStart(jobId3)
      exec.executed(jobId3, SAVE_IMAGE_NODE, imageOutput('saved3.png'))
      await exec.completeWithHistory(jobId3, SAVE_IMAGE_NODE, 'saved3.png')

      await expect(
        comfyPage.appMode.outputHistory.selectedNonAssetItem
      ).toBeVisible()
    })

    test('Batch navigation visible with multiple images', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const { exec, jobId } = await startExecution(comfyPage, ws)

      exec.executedImageCompare(
        jobId,
        IMAGE_COMPARE_NODE,
        ['before1.png', 'before2.png'],
        ['after1.png']
      )

      await expect(
        comfyPage.appMode.outputHistory.compareOutputs.first()
      ).toBeVisible()
      await expect(comfyPage.appMode.outputHistory.batchNav).toBeVisible()
    })
  })
})
