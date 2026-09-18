import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const TOOL_ERROR_CASE = 'agent-rec-tool-error'

test.describe(
  'Agent V1 visual baselines',
  { tag: ['@cloud', '@screenshot'] },
  () => {
    test.use({ conversationCase: TOOL_ERROR_CASE, projectCanvas: false })

    test('covers panel, composer, tool call, and error states', async ({
      agentConversation
    }) => {
      const { panel } = agentConversation

      await expect(panel).toHaveScreenshot('agent-panel.png')

      const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
      await composer.fill('Build a deterministic red fox workflow')
      await expect(composer).toHaveText(
        'Build a deterministic red fox workflow'
      )
      await expect(panel.getByTestId('composer-inline-input')).toHaveScreenshot(
        'agent-composer.png'
      )
      await composer.clear()

      await agentConversation.runTurns()

      const successfulToolCall = panel
        .getByRole('listitem')
        .filter({ hasText: 'Switched tabs' })
      await expect(successfulToolCall).toBeVisible()
      await expect(successfulToolCall).toHaveScreenshot('agent-tool-call.png')

      const failedToolCall = panel
        .getByRole('listitem')
        .filter({ hasText: 'Add node' })
      await expect(failedToolCall).toBeVisible()
      await expect(failedToolCall).toHaveScreenshot('agent-error.png')
    })
  }
)
