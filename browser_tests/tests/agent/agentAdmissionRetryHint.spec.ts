import { expect, mergeTests } from '@playwright/test'

import {
  MANUAL_BLOCK_ADMISSION_DENIAL,
  MANUAL_BLOCK_ADMISSION_MESSAGE
} from '@e2e/fixtures/data/agent/agentAdmissionDenials'
import { webSocketFixture } from '@e2e/fixtures/ws'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe('In-App Agent admission denials', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('does not invite a retry on a deliberate manual_block denial', async ({
    agentPanel
  }) => {
    const panel = agentPanel.root
    const prompt = 'Upscale the hero shot'

    await test.step('reject every turn with a manual_block denial', async () => {
      await agentPanel.rejectEveryTurn(MANUAL_BLOCK_ADMISSION_DENIAL)
    })

    await test.step('open the agent panel on a workflow', async () => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    await test.step('send a prompt the server will reject', async () => {
      await agentPanel.sendMessage(prompt)
    })

    await test.step('surface the denial without a retry hint', async () => {
      // Exact text, because three other things render the server message
      // inside a `role="alert"` and a substring match accepts all of them:
      // the generic `agent.sendFailed` path ("Message failed to send: <server
      // message>"), the paywall card, and the admission alert WITH
      // `agent.retryAfterSeconds` appended. A non-retryable 402 must produce
      // only the message — no generic prefix, no paywall framing, and no
      // invitation to wait and try again, even though the response carried a
      // `Retry-After` header.
      await expect(panel.getByRole('alert')).toHaveText(
        MANUAL_BLOCK_ADMISSION_MESSAGE
      )
    })
  })
})
