import { expect } from '@playwright/test'

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  agentTest as test,
  FUNDS_UNAVAILABLE_MESSAGE
} from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Agent rate-limit retry submission',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ agentRetryAfter: '30' })

    const prompt = 'Make a red fox in the snow'

    async function rejectOneSend({
      agentPanel,
      postedMessages
    }: {
      agentPanel: AgentPanel
      postedMessages: string[]
    }): Promise<void> {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await agentPanel.composer.fill(prompt)
      await agentPanel.composer.press('Enter')
      await expect(
        agentPanel.root.getByText(FUNDS_UNAVAILABLE_MESSAGE)
      ).toBeVisible()
      await expect(agentPanel.composer).toHaveText(prompt)
      await expect(agentPanel.sendButton).toBeEnabled()
      await expect.poll(() => postedMessages).toHaveLength(1)
    }

    test('keeps repeated Enter presses to one rejected send', async ({
      agentPanel,
      postedMessages
    }) => {
      await rejectOneSend({ agentPanel, postedMessages })

      await agentPanel.composer.press('Enter')
      await agentPanel.composer.press('Enter')
      await expect(agentPanel.composer).toHaveText(prompt)
      await expect(agentPanel.sendButton).toBeEnabled()

      await expect(
        agentPanel.root.getByTestId('user-message-bubble')
      ).toHaveText([prompt])
      await expect.poll(() => postedMessages).toHaveLength(1)
    })

    test('retries the restored prompt from the Send button', async ({
      agentPanel,
      postedMessages
    }) => {
      await rejectOneSend({ agentPanel, postedMessages })

      await agentPanel.sendButton.click()

      await expect.poll(() => postedMessages).toHaveLength(2)
      await expect(agentPanel.composer).toHaveText(prompt)
      await expect(agentPanel.sendButton).toBeEnabled()
    })

    test('allows Enter again once the restored prompt is edited', async ({
      agentPanel,
      postedMessages
    }) => {
      await rejectOneSend({ agentPanel, postedMessages })

      const edited = `${prompt} at dusk`
      await agentPanel.composer.fill(edited)
      await expect(agentPanel.composer).toHaveText(edited)
      await agentPanel.composer.press('Enter')

      await expect.poll(() => postedMessages).toHaveLength(2)
      await expect(agentPanel.composer).toHaveText(edited)
    })
  }
)
