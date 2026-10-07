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
          await agentTest.step(
            'open the agent and select the workflow',
            async () => {
              await agentPanel.open()
              await agentPanel.selectWorkflow()
            }
          )

          await agentTest.step('submit a prompt', async () => {
            await agentPanel.sendMessage('Make a red fox in the snow')
          })

          await agentTest.step(
            'show the admission error and retry delay',
            async () => {
              await expect(
                agentPanel.root.getByText(FUNDS_UNAVAILABLE_MESSAGE)
              ).toBeVisible()
              await expect(
                agentPanel.root.getByText(
                  enMessages.agent.retryAfterSeconds.replace('{seconds}', '30')
                )
              ).toBeVisible()
              await expect(
                agentPanel.root.getByText(enMessages.agent.paywall.title, {
                  exact: true
                })
              ).toHaveCount(0)
              await expect(agentPanel.composer).toBeEditable()
            }
          )
        }
      )
    })
  }
)
