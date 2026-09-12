import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  openErrorsTab,
  queueWorkflowAndOpenExecutionErrors
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const webSocketTest = mergeTests(test, webSocketFixture)

test.describe('Errors tab - Execution errors', { tag: '@ui' }, () => {
  test.use({ initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true } })

  test.beforeEach(async ({ comfyPage }) => {
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup()
  })

  test('Should show Find on GitHub and Copy buttons in error card', async ({
    comfyPage
  }) => {
    await queueWorkflowAndOpenExecutionErrors(comfyPage)

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
    await queueWorkflowAndOpenExecutionErrors(comfyPage)

    const runtimePanel = comfyPage.page.getByTestId(
      TestIds.dialogs.runtimeErrorPanel
    )
    await expect(runtimePanel).toBeVisible()
    await expect(runtimePanel).toContainText('Error log')
  })
})

test.describe('Errors tab - Execution error lifecycle', { tag: '@ui' }, () => {
  test.use({
    initialSettings: {
      'Comfy.RightSidePanel.ShowErrorsTab': true,
      'Comfy.Workflow.WorkflowTabsPosition': 'Sidebar'
    }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.menu.workflowsTab.open()
  })

  test('Should keep an execution error on the workflow that produced it', async ({
    comfyPage
  }) => {
    await queueWorkflowAndOpenExecutionErrors(comfyPage)

    const runtimePanel = comfyPage.page.getByTestId(
      TestIds.dialogs.runtimeErrorPanel
    )
    await expect(runtimePanel).toBeVisible()

    const workflowsTab = comfyPage.menu.workflowsTab
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toContain('*execution_error')

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await expect(runtimePanel).toBeHidden()

    const panel = new PropertiesPanelHelper(comfyPage.page)
    await panel.open(comfyPage.actionbar.propertiesButton)
    await expect(panel.root).toBeVisible()
    await expect(panel.errorsTab).toBeHidden()

    await workflowsTab.switchToWorkflow('execution_error')
    await openErrorsTab(comfyPage)
    await expect(runtimePanel).toBeVisible()
  })

  test('Should keep an execution error after the workflow is renamed', async ({
    comfyPage
  }) => {
    await queueWorkflowAndOpenExecutionErrors(comfyPage)

    const runtimePanel = comfyPage.page.getByTestId(
      TestIds.dialogs.runtimeErrorPanel
    )
    await expect(runtimePanel).toBeVisible()

    await comfyPage.menu.topbar.saveWorkflowAs('execution-error-before-rename')
    await expect(comfyPage.page.getByTestId('dialog-overlay')).toBeHidden()

    const workflowsTab = comfyPage.menu.workflowsTab
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toContain('execution-error-before-rename')

    await workflowsTab.renameWorkflow(
      workflowsTab.getOpenedItem('execution-error-before-rename'),
      'execution-error-after-rename'
    )
    await expect
      .poll(() => workflowsTab.getOpenedWorkflowNames())
      .toContain('execution-error-after-rename')

    await openErrorsTab(comfyPage)
    await expect(runtimePanel).toBeVisible()
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
