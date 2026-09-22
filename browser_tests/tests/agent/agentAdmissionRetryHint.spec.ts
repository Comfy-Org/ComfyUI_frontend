import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'

import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

// Backfill for https://github.com/Comfy-Org/ComfyUI_frontend/pull/17532
// (fix(agent): honour Retry-After for funds_unavailable admission denials,
// https://linear.app/comfyorg/issue/FE-2005). The positive funds_unavailable
// path is covered by `agentRetryAfterNotice.spec.ts`; this guards the reason
// discrimination that keeps manual blocks non-retryable.
//
// Parsed through the generated admission contract so a server-side rename of
// a `reason` or `type` breaks the fixture instead of silently passing.
const MANUAL_BLOCK_ERROR = zAgentAdmissionError.parse({
  error: {
    message: 'This account cannot run the agent.',
    reason: 'manual_block',
    type: 'PAYMENT_REQUIRED'
  }
})

const RETRY_AFTER_SECONDS = 45

test.describe('In-App Agent admission denials', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('does not invite a retry on a deliberate manual_block denial', async ({
    agentPanel
  }) => {
    const panel = agentPanel.root
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    const prompt = 'Upscale the hero shot'

    await test.step('reject the next turn with a manual_block denial', async () => {
      await agentPanel.rejectNextTurn(
        402,
        MANUAL_BLOCK_ERROR,
        RETRY_AFTER_SECONDS
      )
    })

    await test.step('open the agent panel on a workflow', async () => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    await test.step('send a prompt the server will reject', async () => {
      await composer.fill(prompt)
      await panel.getByRole('button', { name: 'Send' }).click()
    })

    await test.step('surface the denial without a retry hint', async () => {
      const notice = panel.getByRole('alert')
      await expect(notice).toContainText('This account cannot run the agent.')
      // A non-retryable 402 must not tell the user to wait and try again, even
      // though the response carried a `Retry-After` header.
      await expect(notice).not.toContainText('You can try again in')
    })
  })
})
