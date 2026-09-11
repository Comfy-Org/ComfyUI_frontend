import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  FIRST_RUN_INTERMEDIATE_NODE_ID,
  FIRST_RUN_INTERMEDIATE_OUTPUT,
  FIRST_RUN_JOB_ID,
  FIRST_RUN_OUTPUT,
  FIRST_RUN_OUTPUT_NODE_ID,
  FIRST_RUN_START_TEMPLATE_ID
} from '@e2e/fixtures/data/firstRunTour'
import { postFirstRunFixture as test } from '@e2e/fixtures/postFirstRunFixture'

test.use({ video: 'on' })

test.describe('Post-first-run races', { tag: ['@cloud', '@ui'] }, () => {
  test.describe.configure({ timeout: 45_000 })
  test.use({
    connectWebSocketToServer: false,
    initialSettings: {
      'Comfy.TutorialCompleted': false,
      'Comfy.OnboardingCoachmarks.Seen': ['appMode'],
      'Comfy.VueNodes.Enabled': true
    },
    initialFeatureFlags: { onboarding_tour_enabled: true }
  })

  test('keeps output received after tour dismissal until HTTP acceptance', async ({
    comfyPage,
    execution,
    firstRunNudge,
    firstRunRoutes,
    postFirstRun
  }) => {
    await test.step('Submit, then finish the tour while acceptance is pending', async () => {
      await postFirstRun.openTour()
      await postFirstRun.submitFromTour()
      await firstRunRoutes.waitForPrompt()
      await postFirstRun.finishTour()
    })

    await test.step('Receive the saved result before the HTTP response', async () => {
      execution.executionStart(FIRST_RUN_JOB_ID)
      execution.executed(FIRST_RUN_JOB_ID, FIRST_RUN_OUTPUT_NODE_ID, {
        images: [FIRST_RUN_OUTPUT]
      })
      await postFirstRun.expectOutputImage(
        FIRST_RUN_OUTPUT_NODE_ID,
        FIRST_RUN_OUTPUT.filename
      )
      await comfyPage.page.clock.runFor(2000)
      await expect(firstRunNudge.root).toBeHidden()
    })

    await test.step('Accept the job and wait for its successful completion', async () => {
      await firstRunRoutes.acceptPrompt()
      await comfyPage.nextFrame()
      await expect(firstRunNudge.root).toBeHidden()
      execution.executionSuccess(FIRST_RUN_JOB_ID)
    })

    await test.step('Continue with the buffered image in the newly loaded graph', async () => {
      await postFirstRun.expectContinuationWithFinalImage()
    })
  })

  test('correlates WebSocket output and success that both precede HTTP acceptance', async ({
    comfyPage,
    execution,
    firstRunNudge,
    firstRunRoutes,
    postFirstRun
  }) => {
    await test.step('Finish the tour before queue acceptance or output arrives', async () => {
      await postFirstRun.openTour()
      await postFirstRun.submitFromTour()
      await firstRunRoutes.waitForPrompt()
      await postFirstRun.finishTour()
    })

    await test.step('Receive output and success while the HTTP response is held', async () => {
      execution.executionStart(FIRST_RUN_JOB_ID)
      execution.executed(FIRST_RUN_JOB_ID, FIRST_RUN_OUTPUT_NODE_ID, {
        images: [FIRST_RUN_OUTPUT]
      })
      execution.executionSuccess(FIRST_RUN_JOB_ID)
      await postFirstRun.expectOutputImage(
        FIRST_RUN_OUTPUT_NODE_ID,
        FIRST_RUN_OUTPUT.filename
      )
      await comfyPage.page.clock.runFor(2000)
      await expect(firstRunNudge.root).toBeHidden()
    })

    await test.step('Release acceptance and continue with the correlated result', async () => {
      await firstRunRoutes.acceptPrompt()
      await postFirstRun.expectContinuationWithFinalImage()
    })
  })

  test.describe('a catalog that loads before the generated result', () => {
    test.use({ deferFirstRunCatalog: true })

    test('waits for generation and includes output arriving after success but before impression', async ({
      comfyPage,
      execution,
      firstRunNudge,
      firstRunRoutes,
      postFirstRun
    }) => {
      await test.step('Keep the initial catalog pending, then release it to start the tour', async () => {
        await firstRunRoutes.waitForCatalog()
        await expect(
          comfyPage.page.getByTestId(
            `getting-started-card-${FIRST_RUN_START_TEMPLATE_ID}`
          )
        ).toBeHidden()
        await firstRunRoutes.releaseCatalog()
        await postFirstRun.openTour()
      })

      await test.step('Accept the run and end the tour with the catalog already ready', async () => {
        await postFirstRun.submitFromTour()
        await firstRunRoutes.waitForPrompt()
        await firstRunRoutes.acceptPrompt()
        execution.executionStart(FIRST_RUN_JOB_ID)
        await postFirstRun.finishTour()
        await comfyPage.page.clock.runFor(2000)
        await expect(firstRunNudge.root).toBeHidden()
      })

      await test.step('Receive success followed by the final image before the first impression', async () => {
        execution.executionSuccess(FIRST_RUN_JOB_ID)
        execution.executed(FIRST_RUN_JOB_ID, FIRST_RUN_OUTPUT_NODE_ID, {
          images: [FIRST_RUN_OUTPUT]
        })
      })

      await test.step('Offer the continuation and seed its real image input', async () => {
        await postFirstRun.expectContinuationWithFinalImage()
      })
    })
  })

  test('uses the declared result instead of an intermediate saved image', async ({
    comfyPage,
    execution,
    firstRunNudge,
    firstRunRoutes,
    postFirstRun
  }) => {
    await test.step('Accept the run and finish the tour while generation continues', async () => {
      await postFirstRun.openTour()
      await postFirstRun.submitFromTour()
      await firstRunRoutes.waitForPrompt()
      await firstRunRoutes.acceptPrompt()
      execution.executionStart(FIRST_RUN_JOB_ID)
      await postFirstRun.finishTour()
    })

    await test.step('Save an intermediate image from a different output node first', async () => {
      execution.executed(FIRST_RUN_JOB_ID, FIRST_RUN_INTERMEDIATE_NODE_ID, {
        images: [FIRST_RUN_INTERMEDIATE_OUTPUT]
      })
      await postFirstRun.expectOutputImage(
        FIRST_RUN_INTERMEDIATE_NODE_ID,
        FIRST_RUN_INTERMEDIATE_OUTPUT.filename
      )
      await comfyPage.page.clock.runFor(2000)
      await expect(firstRunNudge.root).toBeHidden()
    })

    await test.step('Save the designated result and complete the job successfully', async () => {
      execution.executed(FIRST_RUN_JOB_ID, FIRST_RUN_OUTPUT_NODE_ID, {
        images: [FIRST_RUN_OUTPUT]
      })
      execution.executionSuccess(FIRST_RUN_JOB_ID)
    })

    await test.step('Forward the designated final file to the continuation graph', async () => {
      await postFirstRun.expectContinuationWithFinalImage()
    })
  })

  test('keeps the visible fallback when the declared result arrives late', async ({
    comfyPage,
    execution,
    firstRunNudge,
    firstRunRoutes,
    postFirstRun
  }) => {
    await test.step('Run the template and finish its tour', async () => {
      await postFirstRun.openTour()
      await postFirstRun.submitFromTour()
      await firstRunRoutes.waitForPrompt()
      await firstRunRoutes.acceptPrompt()
      execution.executionStart(FIRST_RUN_JOB_ID)
      await postFirstRun.finishTour()
    })

    await test.step('Complete successfully without an image from the declared result node', async () => {
      execution.executed(FIRST_RUN_JOB_ID, FIRST_RUN_INTERMEDIATE_NODE_ID, {
        images: [FIRST_RUN_INTERMEDIATE_OUTPUT]
      })
      execution.executionSuccess(FIRST_RUN_JOB_ID)
      await expect(firstRunNudge.root).toBeVisible()
      await expect(firstRunNudge.actions).toHaveCount(0)
    })

    await test.step('Process a late final image without rewriting the visible fallback', async () => {
      execution.executed(FIRST_RUN_JOB_ID, FIRST_RUN_OUTPUT_NODE_ID, {
        images: [FIRST_RUN_OUTPUT]
      })
      await postFirstRun.expectOutputImage(
        FIRST_RUN_OUTPUT_NODE_ID,
        FIRST_RUN_OUTPUT.filename
      )
      await expect(firstRunNudge.actions).toHaveCount(0)
    })

    await test.step('Use the fallback to open the real template browser', async () => {
      await firstRunNudge.explore.click()
      await expect(firstRunNudge.root).toBeHidden()
      await expect(comfyPage.templatesDialog.root).toBeVisible()
      await comfyPage.page.keyboard.press('Escape')
      await expect(comfyPage.templatesDialog.root).toBeHidden()
    })
  })
})
