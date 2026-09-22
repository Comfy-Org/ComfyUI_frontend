import { expect, mergeTests } from '@playwright/test'

import {
  MANUAL_BLOCK_ADMISSION_DENIAL,
  MANUAL_BLOCK_ADMISSION_MESSAGE
} from '@e2e/fixtures/data/agent/agentAdmissionDenials'
import { webSocketFixture } from '@e2e/fixtures/ws'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

// This fills the manual_block contrast left by agentRetryAfterNotice.spec.ts.
// Only generated frontend contract changes break the typed mock, not
// server-only drift.
test.describe('In-App Agent admission denials', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('does not invite a retry on a deliberate manual_block denial', async ({
    agentPanel
  }) => {
    const panel = agentPanel.root
    const prompt = 'Upscale the hero shot'

    await test.step('reject the next turn with a manual_block denial', async () => {
      await agentPanel.rejectNextTurn(MANUAL_BLOCK_ADMISSION_DENIAL)
    })

    await test.step('open the agent panel on a workflow', async () => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    await test.step('send a prompt the server will reject', async () => {
      await agentPanel.sendMessage(prompt)
    })

    await test.step('surface the denial without a retry hint', async () => {
      const notice = panel.getByRole('alert')
      await expect(notice).toContainText(MANUAL_BLOCK_ADMISSION_MESSAGE)
      // A non-retryable 402 must not tell the user to wait and try again, even
      // though the response carried a `Retry-After` header.
      await expect(notice).not.toContainText('You can try again in')
    })
  })
})
