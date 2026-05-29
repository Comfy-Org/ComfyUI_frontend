import { mergeTests } from '@playwright/test'

import type { NodeError } from '@/schemas/apiSchema'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const VALIDATION_ERROR_NODE_ID = '1'
const VALIDATION_ERROR_MESSAGE = 'Required input is missing: source'
const PARTIAL_EXECUTION_ROOT_NODE_IDS = ['1', '4']

type PromptRequestNode = {
  class_type?: string
}

type PromptRequestBody = {
  prompt?: Record<string, PromptRequestNode>
}

function buildPreviewAnyValidationError(): NodeError {
  return {
    class_type: 'PreviewAny',
    dependent_outputs: [VALIDATION_ERROR_NODE_ID],
    errors: [
      {
        type: 'required_input_missing',
        message: VALIDATION_ERROR_MESSAGE,
        details: '',
        extra_info: { input_name: 'source' }
      }
    ]
  }
}

function expectPartialExecutionRootNodes(requestBody: unknown): void {
  const prompt = (requestBody as PromptRequestBody).prompt ?? {}

  for (const nodeId of PARTIAL_EXECUTION_ROOT_NODE_IDS) {
    expect(prompt[nodeId]).toMatchObject({ class_type: 'PreviewAny' })
  }
}

async function getValidationErrorMessage(comfyPage: ComfyPage) {
  return await comfyPage.page.evaluate(
    (nodeId) =>
      window.app!.extensionManager.lastNodeErrors?.[nodeId]?.errors[0]
        ?.message ?? null,
    VALIDATION_ERROR_NODE_ID
  )
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Execution', { tag: ['@smoke', '@workflow'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
  })

  test(
    'Report error on unconnected slot',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.canvasOps.disconnectEdge()
      await comfyPage.page.keyboard.press('Escape')

      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()
      await errorOverlay.waitFor({ state: 'hidden' })
      await expect(comfyPage.canvas).toHaveScreenshot(
        'execution-error-unconnected-slot.png'
      )
    }
  )
})

test.describe(
  'Execute to selected output nodes',
  { tag: ['@smoke', '@workflow'] },
  () => {
    test('Execute to selected output nodes', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('execution/partial_execution')
      const input = await comfyPage.nodeOps.getNodeRefById(3)
      const output1 = await comfyPage.nodeOps.getNodeRefById(1)
      const output2 = await comfyPage.nodeOps.getNodeRefById(4)
      await expect
        .poll(async () => (await input.getWidget(0)).getValue())
        .toBe('foo')
      await expect
        .poll(async () => (await output1.getWidget(0)).getValue())
        .toBe('')
      await expect
        .poll(async () => (await output2.getWidget(0)).getValue())
        .toBe('')

      await output1.click('title')

      await comfyPage.command.executeCommand('Comfy.QueueSelectedOutputNodes')
      await expect
        .poll(async () => (await input.getWidget(0)).getValue())
        .toBe('foo')
      await expect
        .poll(async () => (await output1.getWidget(0)).getValue())
        .toBe('foo')
      await expect
        .poll(async () => (await output2.getWidget(0)).getValue())
        .toBe('')
    })
  }
)

test.describe('Execution validation errors', { tag: '@workflow' }, () => {
  test('preserves validation errors when another active root starts execution', async ({
    comfyPage,
    getWebSocket
  }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
    await comfyPage.workflow.loadWorkflow('execution/partial_execution')

    const ws = await getWebSocket()
    const exec = new ExecutionHelper(comfyPage, ws)
    const nodeErrors = {
      [VALIDATION_ERROR_NODE_ID]: buildPreviewAnyValidationError()
    }
    let promptRequestBody: unknown

    const jobId = await exec.run({
      nodeErrors,
      onPromptRequest: (requestBody) => {
        promptRequestBody = requestBody
      }
    })
    expectPartialExecutionRootNodes(promptRequestBody)
    await expect
      .poll(() => getValidationErrorMessage(comfyPage))
      .toBe(VALIDATION_ERROR_MESSAGE)
    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()

    await comfyPage.nextFrame()
    exec.executionStart(jobId)

    await expect
      .poll(() => getValidationErrorMessage(comfyPage))
      .toBe(VALIDATION_ERROR_MESSAGE)
    await expect(errorOverlay).toBeVisible()
  })
})
