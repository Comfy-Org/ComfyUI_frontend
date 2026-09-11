import { mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { webSocketFixture } from '@e2e/fixtures/ws'

const webSocketTest = mergeTests(test, webSocketFixture)

test.describe('Errors tab - Execution errors', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup()
  })

  async function openExecutionErrorTab(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('nodes/execution_error')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()
    await errorOverlay
      .getByTestId(TestIds.dialogs.errorOverlaySeeErrors)
      .click()
    await expect(errorOverlay).toBeHidden()
  }

  test('Should show Find on GitHub and Copy buttons in error card', async ({
    comfyPage
  }) => {
    await openExecutionErrorTab(comfyPage)

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorCardFindOnGithub)
    ).toBeVisible()
    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorCardCopy)
    ).toBeVisible()
  })

  test('Should show runtime error log in the execution error group', async ({
    comfyPage
  }) => {
    await openExecutionErrorTab(comfyPage)

    const runtimePanel = comfyPage.page.getByTestId(
      TestIds.dialogs.runtimeErrorPanel
    )
    await expect(runtimePanel).toBeVisible()
    await expect(runtimePanel).toContainText('Error log')
  })
})

webSocketTest.describe(
  'Errors tab - early execution errors',
  { tag: '@ui' },
  () => {
    webSocketTest(
      'Should surface an execution error received before the prompt response',
      async ({ comfyPage, getWebSocket }) => {
        await comfyPage.settings.setSetting(
          'Comfy.RightSidePanel.ShowErrorsTab',
          true
        )
        await comfyPage.workflow.loadWorkflow('nodes/execution_error')
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const errorReceived = comfyPage.page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              window.app!.api.addEventListener(
                'execution_error',
                () => resolve(),
                {
                  once: true
                }
              )
            })
        )

        await execution.run({
          beforePromptResponse: async (jobId) => {
            execution.executionError(jobId, '17', 'Early execution failure')
            await errorReceived
          }
        })

        await expect(
          comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
        ).toBeVisible()
      }
    )
  }
)
