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
    await exec.completeWithHistory(jobId, SAVE_IMAGE_NODE, 'lifecycle_out.png')

    await expect(comfyPage.appMode.outputHistory.inProgressItems).toHaveCount(0)
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

  test('Clicking item breaks auto-follow during execution', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    const { exec, jobId } = await startExecution(comfyPage, ws)

    // Send first image
    exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('first.png'))
    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)

    // Click the first image to break auto-follow
    await comfyPage.appMode.outputHistory.inProgressItems.first().click()

    // Send second image - selection should NOT move to it
    exec.executed(jobId, SAVE_IMAGE_NODE, imageOutput('second.png'))
    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(2)

    // The first item should still be selected (not auto-followed to second)
    await expect(
      comfyPage.appMode.outputHistory.selectedInProgressItem
    ).toHaveCount(1)
    await expect(
      comfyPage.appMode.outputHistory.selectedInProgressItem.getByTestId(
        'linear-image-output'
      )
    ).toHaveAttribute('src', /first\.png/)
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

    await expect(comfyPage.appMode.outputHistory.historyItems).toHaveCount(100)

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

    await expect(comfyPage.appMode.outputHistory.inProgressItems).toHaveCount(0)
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
    await expect(headerOverallProgress).toHaveAttribute('style', /width:\s*0%/)
    await expect(headerNodeProgress).toHaveAttribute('style', /width:\s*0%/)

    // KSampler starts executing - node progress at 50%
    exec.executing(jobId, KSAMPLER_NODE)
    exec.progress(jobId, KSAMPLER_NODE, 5, 10)

    await expect(headerNodeProgress).toHaveAttribute('style', /width:\s*50%/)
    await expect(itemNodeProgress).toHaveAttribute('style', /width:\s*50%/)
    // Overall still 0% - no nodes completed yet
    await expect(headerOverallProgress).toHaveAttribute('style', /width:\s*0%/)

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
    await expect(itemOverallProgress).toHaveAttribute('style', /width:\s*100%/)
  })
})
