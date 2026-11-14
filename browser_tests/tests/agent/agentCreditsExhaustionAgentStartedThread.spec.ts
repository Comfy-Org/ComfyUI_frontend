import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  AGENT_OPENING_LINE,
  EARLIER_USER_MESSAGE,
  FIRST_REPLY,
  NO_FUNDS_MESSAGE,
  test
} from '@e2e/tests/agent/agentCreditsExhaustionAgentStartedMocks'

test.describe(
  'Agent standing credits-exhaustion on a thread the agent started',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.beforeEach(async ({ agentPanel }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    test('keeps the card hidden until the first reply, then explains credits on the refusal', async ({
      agentPanel
    }) => {
      const paywall = agentPanel.creditsExhaustedPaywall

      await test.step('the agent speaks first and nothing claims the user is out of credits', async () => {
        await expect(
          agentPanel.root.getByText(AGENT_OPENING_LINE)
        ).toBeVisible()
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveCount(0)
        await expect(agentPanel.composer).toBeVisible()
        await expect(paywall).toHaveCount(0)
        await expect(agentPanel.root.getByRole('alert')).toHaveCount(0)
      })

      await test.step('the first reply is refused with a credits card that offers a way out', async () => {
        await agentPanel.sendMessage(FIRST_REPLY)
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText([FIRST_REPLY])
        await expect(paywall).toBeVisible()
        await expect(paywall).toContainText(NO_FUNDS_MESSAGE)
        await expect(
          paywall.getByRole('button', {
            name: enMessages.agent.paywall.addCredits
          })
        ).toBeVisible()
        await expect(agentPanel.root.getByRole('alert')).toHaveCount(1)
      })
    })

    test.describe('with an earlier user turn', () => {
      test.use({ threadSeed: 'userReplied' })

      test('shows the card on the restored thread', async ({ agentPanel }) => {
        await expect(
          agentPanel.root.getByTestId('user-message-bubble')
        ).toHaveText([EARLIER_USER_MESSAGE])
        await expect(agentPanel.creditsExhaustedPaywall).toBeVisible()
      })
    })
  }
)
