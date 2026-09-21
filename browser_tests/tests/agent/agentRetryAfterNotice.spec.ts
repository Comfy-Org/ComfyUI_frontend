import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest,
  FUNDS_UNAVAILABLE_MESSAGE
} from '@e2e/tests/agent/agentPanelMocks'

agentTest.describe(
  'Agent Retry-After notice',
  { tag: ['@cloud', '@ui'] },
  () => {
    agentTest.describe('with delay-seconds', () => {
      agentTest.use({ agentRetryAfter: '30' })

      agentTest(
        'shows the retry delay the header names',
        async ({ agentPanel }) => {
          await agentPanel.open()
          await agentPanel.selectWorkflow()
          await agentPanel.sendMessage('Make a red fox in the snow')

          await expect(
            agentPanel.root.getByText(FUNDS_UNAVAILABLE_MESSAGE)
          ).toBeVisible()
          await expect(
            agentPanel.root.getByText(
              enMessages.agent.retryAfterSeconds.replace('{seconds}', '30')
            )
          ).toBeVisible()
        }
      )
    })

    agentTest.describe('with a non-HTTP date', () => {
      agentTest.use({ agentRetryAfter: '2099-12-31T00:00:00' })

      agentTest('offers no retry delay', async ({ agentPanel }) => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.sendMessage('Make a red fox in the snow')

        await expect(
          agentPanel.root.getByText(FUNDS_UNAVAILABLE_MESSAGE)
        ).toBeVisible()
        await expect(
          agentPanel.root.getByText(
            enMessages.agent.retryAfterSeconds.split('{seconds}')[0]
          )
        ).toHaveCount(0)
      })
    })
  }
)
