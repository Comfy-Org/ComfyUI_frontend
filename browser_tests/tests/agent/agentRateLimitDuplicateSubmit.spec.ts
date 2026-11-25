import { expect } from '@playwright/test'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'

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
      await expect(agentPanel.pendingSendError).toContainText(
        FUNDS_UNAVAILABLE_MESSAGE
      )
      await expect(agentPanel.composer).toHaveText('')
      await expect(agentPanel.retryPendingButton).toBeDisabled()
      await expect(agentPanel.deletePendingButton).toBeEnabled()
      await expect.poll(() => postedMessages).toHaveLength(1)
    }

    test('disables Retry while Retry-After holds and leaves the composer free', async ({
      agentPanel,
      postedMessages
    }) => {
      await rejectOneSend({ agentPanel, postedMessages })

      await agentPanel.composer.press('Enter')
      await agentPanel.composer.press('Enter')
      await expect(agentPanel.composer).toHaveText('')
      await expect(agentPanel.retryPendingButton).toBeDisabled()

      await expect(agentPanel.userMessageBubbles).toHaveText([prompt])
      await expect.poll(() => postedMessages).toHaveLength(1)
    })

    test('allows sending a new prompt from the composer while the failed message waits', async ({
      agentPanel,
      postedMessages
    }) => {
      await rejectOneSend({ agentPanel, postedMessages })

      const followUp = `${prompt} at dusk`
      await agentPanel.composer.fill(followUp)
      await expect(agentPanel.composer).toHaveText(followUp)
      await agentPanel.composer.press('Enter')

      await expect.poll(() => postedMessages).toHaveLength(2)
      expect(
        zAgentPostMessageRequest.parse(JSON.parse(postedMessages[1]))
      ).toMatchObject({ content: followUp })
      await expect(agentPanel.composer).toHaveText('')
      await expect(agentPanel.userMessageBubbles).toHaveText([prompt, followUp])
    })

    test.describe('when the retry window expires', () => {
      test.use({ agentRetryAfter: '1' })

      test('enables Retry after the delay and retries the failed message once', async ({
        agentPanel,
        page,
        postedMessages
      }) => {
        await page.clock.install()
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await page.clock.pauseAt(Date.now() + 1_000)

        await agentPanel.composer.fill(prompt)
        await agentPanel.composer.press('Enter')
        await expect(agentPanel.pendingSendError).toContainText(
          FUNDS_UNAVAILABLE_MESSAGE
        )
        await expect(agentPanel.composer).toHaveText('')
        await expect(agentPanel.retryPendingButton).toBeDisabled()
        await expect(agentPanel.deletePendingButton).toBeEnabled()
        await expect.poll(() => postedMessages).toHaveLength(1)

        await page.clock.runFor(1_100)
        await expect(agentPanel.retryPendingButton).toBeEnabled()
        await page.clock.resume()
        await agentPanel.retryPendingButton.click()

        await expect.poll(() => postedMessages).toHaveLength(2)
        await expect(agentPanel.userMessageBubbles).toHaveText([prompt])
      })
    })
  }
)
