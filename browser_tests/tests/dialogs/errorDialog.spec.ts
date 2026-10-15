import type { PromptErrorResponse } from '@comfyorg/ingest-types'
import type { Page } from '@playwright/test'

import { expect, mergeTests } from '@playwright/test'

import type { ExecutionErrorWsMessage } from '@/platform/remote/comfyui/execution/types'
import type {
  NodeError,
  PromptFailureResponse
} from '@/platform/remote/comfyui/types'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  interceptClipboardWrite,
  getClipboardText
} from '@e2e/fixtures/utils/clipboardSpy'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

async function triggerConfigureError(
  comfyPage: ComfyPage,
  message = 'Error on configure!'
) {
  await comfyPage.page.evaluate((msg: string) => {
    const graph = window.graph!
    ;(graph as { configure: () => void }).configure = () => {
      throw new Error(msg)
    }
  }, message)

  await comfyPage.workflow.loadWorkflow('default')

  return comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
}

async function waitForPopupNavigation(page: Page, action: () => Promise<void>) {
  const popupPromise = page.waitForEvent('popup')
  await action()
  const popup = await popupPromise
  await popup.waitForLoadState()
  return popup
}

test.describe('Error dialog', () => {
  test.use({
    initialSettings: {
      'Comfy.UseNewMenu': 'Disabled',
      'Comfy.RightSidePanel.ShowErrorsTab': false
    }
  })

  test.beforeEach(async ({ context }) => {
    await context.route('https://github.com/**/issues**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
    )
    await context.route('https://support.comfy.org/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
    )
  })

  test('Should display an error dialog when graph configure fails', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()
  })

  test('Should display an error dialog when prompt execution fails', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(async () => {
      const app = window.app!
      app.api.queuePrompt = () => {
        throw new Error('Error on queuePrompt!')
      }
      await app.queuePrompt(0)
    })
    const errorDialog = comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
    await expect(errorDialog).toBeVisible()
  })

  test('Should display error message body', async ({ comfyPage }) => {
    const errorDialog = await triggerConfigureError(
      comfyPage,
      'Test error message body'
    )
    await expect(errorDialog).toBeVisible()
    await expect(errorDialog).toContainText('Test error message body')
  })

  test('Should show report section when "Show Report" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()
    await expect(errorDialog.locator('pre')).toBeHidden()

    await errorDialog.getByTestId(TestIds.dialogs.errorDialogShowReport).click()

    const reportPre = errorDialog.locator('pre')
    await expect(reportPre).toBeVisible()
    await expect(reportPre).toHaveText(/\S/)
    await expect(
      errorDialog.getByTestId(TestIds.dialogs.errorDialogShowReport)
    ).toBeHidden()
  })

  test('Should copy report to clipboard when "Copy to Clipboard" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()

    await errorDialog.getByTestId(TestIds.dialogs.errorDialogShowReport).click()
    await expect(errorDialog.locator('pre')).toBeVisible()

    await interceptClipboardWrite(comfyPage.page)

    await errorDialog.getByTestId(TestIds.dialogs.errorDialogCopyReport).click()

    const reportText = await errorDialog.locator('pre').textContent()
    await expect
      .poll(async () => await getClipboardText(comfyPage.page))
      .toBe(reportText)
  })

  test('Should open GitHub issues search when "Find Issues" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()

    const popup = await waitForPopupNavigation(comfyPage.page, () =>
      errorDialog.getByTestId(TestIds.dialogs.errorDialogFindIssues).click()
    )

    const url = new URL(popup.url())
    expect(url.hostname).toBe('github.com')
    expect(url.pathname).toContain('/issues')

    await popup.close()
  })

  test('Should open contact support when "Help Fix This" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()

    const popup = await waitForPopupNavigation(comfyPage.page, () =>
      errorDialog.getByTestId(TestIds.dialogs.errorDialogContactSupport).click()
    )

    const url = new URL(popup.url())
    expect(url.hostname).toBe('support.comfy.org')

    await popup.close()
  })

  test('Should display extension file hint when available', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      const error = new Error('Extension error!')
      ;(error as Error & { fileName: string }).fileName =
        '/extensions/my-custom-extension/main.js'

      window.app!.extensionManager.dialog.showErrorDialog(error)
    })

    const errorDialog = comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
    await expect(errorDialog).toBeVisible()

    await expect(
      errorDialog.getByText('/extensions/my-custom-extension/main.js')
    ).toBeVisible()
    await expect(
      errorDialog.getByText('This may be due to the following script')
    ).toBeVisible()
  })

  test('Should display string error messages', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.dialog.showErrorDialog(
        'Something went wrong',
        {
          title: 'Custom Error Title'
        }
      )
    })

    const errorDialog = comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
    await expect(errorDialog).toBeVisible()

    await expect(errorDialog.getByText('Custom Error Title')).toBeVisible()
    await expect(errorDialog.getByText('Something went wrong')).toBeVisible()
  })

  test('Should display default title when no title provided', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      window.app!.extensionManager.dialog.showErrorDialog(
        'A simple string error'
      )
    })

    const errorDialog = comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
    await expect(errorDialog).toBeVisible()

    await expect(errorDialog.getByText('Unknown Error')).toBeVisible()
    await expect(errorDialog.getByText('A simple string error')).toBeVisible()
  })

  test.describe('Catalog messages', { tag: ['@ui', '@workflow'] }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    test('preserves HTTP diagnostics when validation details are not text', async ({
      comfyPage
    }) => {
      const response: PromptErrorResponse = {
        node_errors: {
          '3': {
            class_type: 'KSampler',
            dependent_outputs: [],
            errors: [
              {
                type: 'required_input_missing',
                message: 'Required input is missing',
                details: 42,
                extra_info: { input_name: 'positive' }
              }
            ]
          }
        }
      }
      await comfyPage.page.route(
        '**/api/prompt',
        (route) => route.fulfill({ status: 400, json: response }),
        { times: 1 }
      )
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')

      const dialog = comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
      await expect(dialog).toContainText('Required input is missing: 42')
      await dialog.getByTestId(TestIds.dialogs.errorDialogShowReport).click()
      await expect(dialog.locator('pre')).toContainText(
        'Required input is missing: 42'
      )
    })

    for (const scenario of [
      {
        name: 'missing connection',
        error: {
          type: 'required_input_missing',
          message: 'Required input is missing',
          details: 'positive',
          extra_info: { input_name: 'positive' }
        },
        summary: 'Required input slots have no connection feeding them.',
        details: 'KSampler (#3) is missing a required input: positive'
      },
      {
        name: 'incompatible connection',
        error: {
          type: 'return_type_mismatch',
          message: 'Return type mismatch between linked nodes',
          details:
            'positive, received_type(STRING) mismatch input_type(CONDITIONING)',
          extra_info: {
            input_name: 'positive',
            input_config: ['CONDITIONING'],
            received_type: 'STRING'
          }
        },
        summary:
          'Connected nodes are using incompatible input and output types.',
        details:
          "KSampler (#3)'s positive input expects CONDITIONING, but the connected output is STRING."
      },
      {
        name: 'invalid dropdown value',
        error: {
          type: 'value_not_in_list',
          message: 'Value not in list',
          details: "sampler_name: 'retired_sampler' not in ['euler', 'heun']",
          extra_info: {
            input_name: 'sampler_name',
            received_value: 'retired_sampler'
          }
        },
        summary: 'Some input values are not available for this node.',
        details:
          "The value retired_sampler for KSampler (#3)'s sampler_name is not available."
      }
    ] satisfies {
      name: string
      error: NodeError['errors'][number]
      summary: string
      details: string
    }[]) {
      test.describe(scenario.name, () => {
        test.beforeEach(async ({ comfyPage }) => {
          await new ExecutionHelper(comfyPage).mockValidationFailure({
            '3': {
              class_type: 'KSampler',
              dependent_outputs: [],
              errors: [scenario.error]
            }
          })
        })

        test('explains the rejected input after running the workflow', async ({
          comfyPage
        }, testInfo) => {
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')

          const errorDialog = comfyPage.page.getByTestId(
            TestIds.dialogs.errorDialog
          )
          await expect(
            errorDialog.getByRole('heading', {
              name: 'Prompt validation failed'
            })
          ).toBeVisible()
          await expect(errorDialog).toContainText(scenario.summary)
          await expect(errorDialog).toContainText(scenario.details)
          await expect(errorDialog.locator('pre')).toBeHidden()
          await testInfo.attach(scenario.name, {
            body: await errorDialog.screenshot(),
            contentType: 'image/png'
          })
        })
      })
    }

    for (const scenario of [
      {
        name: 'prompt without outputs',
        error: {
          type: 'prompt_no_outputs',
          message: 'Prompt has no outputs',
          details: ''
        },
        title: 'Prompt has no outputs',
        message:
          'The workflow does not contain any output nodes (e.g. Save Image, Preview Image) to produce a result.'
      },
      {
        name: 'unknown prompt error',
        error: {
          type: 'custom_backend_error',
          message: 'Custom backend refused the workflow',
          details: 'The remote scheduler is unavailable.'
        },
        title: 'Prompt execution failed',
        message:
          'Custom backend refused the workflow: The remote scheduler is unavailable.'
      }
    ] satisfies {
      name: string
      error: PromptFailureResponse['error']
      title: string
      message: string
    }[]) {
      test.describe(scenario.name, () => {
        test.beforeEach(async ({ comfyPage }) => {
          const response: PromptFailureResponse = {
            error: scenario.error,
            node_errors: {}
          }
          await comfyPage.page.route(
            '**/api/prompt',
            (route) => route.fulfill({ status: 400, json: response }),
            { times: 1 }
          )
        })

        test('explains the failed prompt after running the workflow', async ({
          comfyPage
        }, testInfo) => {
          await comfyPage.command.executeCommand('Comfy.QueuePrompt')

          const errorDialog = comfyPage.page.getByTestId(
            TestIds.dialogs.errorDialog
          )
          await expect(
            errorDialog.getByRole('heading', { name: scenario.title })
          ).toBeVisible()
          await expect(errorDialog).toContainText(scenario.message)
          await testInfo.attach(scenario.name, {
            body: await errorDialog.screenshot(),
            contentType: 'image/png'
          })
        })
      })
    }

    for (const scenario of [
      {
        name: 'GPU out of memory',
        rawMessage: 'CUDA out of memory. Tried to allocate 512.00 MiB.',
        message:
          'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
      },
      {
        name: 'unknown execution error',
        rawMessage:
          'Custom sampler failed: scheduler implementation unavailable.',
        message: 'Node threw an error during execution.'
      }
    ]) {
      test.describe(scenario.name, () => {
        test.beforeEach(async ({ comfyPage }) => {
          await interceptClipboardWrite(comfyPage.page)
        })

        test('explains the execution failure and preserves its report', async ({
          comfyPage,
          getWebSocket
        }, testInfo) => {
          const ws = await getWebSocket()
          const execution = new ExecutionHelper(comfyPage, ws)
          const jobId = await execution.run()
          execution.executionStart(jobId)
          ws.send(
            JSON.stringify({
              type: 'execution_error',
              data: {
                prompt_id: jobId,
                timestamp: Date.now(),
                node_id: '3',
                node_type: 'KSampler',
                executed: [],
                exception_type: 'RuntimeError',
                exception_message: scenario.rawMessage,
                traceback: ['RuntimeError: sampler execution failed']
              } satisfies ExecutionErrorWsMessage
            })
          )

          const errorDialog = comfyPage.page.getByTestId(
            TestIds.dialogs.errorDialog
          )
          await expect(
            errorDialog.getByRole('heading', {
              name: 'KSampler (#3)',
              exact: true
            })
          ).toBeVisible()
          await expect(errorDialog).toContainText(scenario.message)
          await expect(errorDialog).toContainText(scenario.rawMessage)
          await testInfo.attach(scenario.name, {
            body: await errorDialog.screenshot(),
            contentType: 'image/png'
          })

          await errorDialog
            .getByTestId(TestIds.dialogs.errorDialogShowReport)
            .click()
          const report = errorDialog.locator('pre')
          await expect(report).toContainText(
            `**Exception Message:** ${scenario.rawMessage}`
          )
          await expect(report).toContainText(
            'RuntimeError: sampler execution failed'
          )
          await expect(report).not.toContainText(scenario.message)
          await errorDialog
            .getByTestId(TestIds.dialogs.errorDialogCopyReport)
            .click()
          await expect
            .poll(() => getClipboardText(comfyPage.page))
            .toBe(await report.textContent())
        })
      })
    }
  })
})
