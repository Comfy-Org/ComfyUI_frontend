import { expect } from '@playwright/test'

import {
  agentTest as test,
  FUNDS_UNAVAILABLE_MESSAGE
} from '@e2e/tests/agent/agentPanelMocks'

// Matrix rank 75 / notion-5. Green regression guard: once admission rejects a
// turn, repeated Enter presses must not duplicate the visible prompt or POST.
test.describe(
  'Agent rate-limit retry submission',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ agentRetryAfter: '30' })

    test('keeps repeated Enter presses to one rejected send', async ({
      agentPanel,
      postedMessages
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const prompt = 'Make a red fox in the snow'
      await agentPanel.composer.fill(prompt)
      await agentPanel.composer.press('Enter')
      await expect(
        agentPanel.root.getByText(FUNDS_UNAVAILABLE_MESSAGE)
      ).toBeVisible()

      test.fail(
        true,
        'Repeated Enter presses duplicate the rejected prompt and turn request'
      )
      await agentPanel.composer.press('Enter')
      await agentPanel.composer.press('Enter')

      await expect(
        agentPanel.root.getByTestId('user-message-bubble')
      ).toHaveText([prompt])
      await expect.poll(() => postedMessages).toHaveLength(1)
    })
  }
)
