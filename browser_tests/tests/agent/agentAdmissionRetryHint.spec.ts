import { escapeRegExp } from 'es-toolkit'

import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  MANUAL_BLOCK_ADMISSION_DENIAL,
  MANUAL_BLOCK_ADMISSION_MESSAGE
} from '@e2e/fixtures/data/agent/agentAdmissionDenials'
import { webSocketFixture } from '@e2e/fixtures/ws'

import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

/**
 * ANY rendered retry hint, not just the one for this fixture's 45 seconds. A
 * regression that offers a clamped, defaulted or differently parsed delay is
 * the same defect, and pinning the literal `45s` would let it through.
 */
const ANY_RETRY_HINT = new RegExp(
  escapeRegExp(enMessages.agent.retryAfterSeconds).replace(
    escapeRegExp('{seconds}'),
    '\\d+'
  )
)

test.describe('In-App Agent admission denials', { tag: '@cloud' }, () => {
  test.use({ connectWebSocketToServer: false })

  test('does not invite a retry on a deliberate manual_block denial', async ({
    agentPanel
  }) => {
    const panel = agentPanel.root
    const prompt = 'Upscale the hero shot'

    const postCount =
      await test.step('reject the next turn with a manual_block denial', () =>
        agentPanel.rejectNextTurn(MANUAL_BLOCK_ADMISSION_DENIAL))

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
      // The admission path, not the generic one. `sendFailed` renders
      // "Message failed to send: <server message>", which CONTAINS the
      // admission copy and also carries no retry hint — so a client that
      // stopped recognising this 402 as an admission denial (schema drift, a
      // status/type mismatch) would satisfy both assertions around this one.
      await expect(notice).not.toContainText(enMessages.agent.sendFailed)
      // A non-retryable 402 must not tell the user to wait and try again, even
      // though the response carried a `Retry-After` header.
      // `toContainText`, not `toHaveText`: with a regex the latter requires
      // the WHOLE alert to match, which the hint alone never does, so a
      // negated `toHaveText` would pass with the hint on screen.
      await expect(notice).not.toContainText(ANY_RETRY_HINT)
      // The denial route is one-shot, so a wrongly auto-retried turn would
      // succeed against the fixture's success handler and could replace the
      // alert above. Exactly one POST is what makes the assertions mean what
      // they say.
      expect(postCount()).toBe(1)
    })
  })
})
