import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

const EXTENSION_CHANGE_CASE = 'repro/pm-2147-extension-change-card'

test.describe(
  'Agent node pack change card',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: EXTENSION_CHANGE_CASE })

    test(
      'shows which pack the agent turned off and that a restart applies it',
      { tag: ['@screenshot'] },
      async ({ agentConversation }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        const card = agentConversation.panel.getByTestId(
          'agent-extension-change'
        )
        await expect(card).toHaveCount(1)
        await expect(card).toContainText(
          'Turned off the node pack comfy-cushions'
        )
        await expect(card).toContainText('Created by agent')
        await expect(card).toContainText(
          'This takes effect after ComfyUI restarts.'
        )
        await expect(
          agentConversation.panel.getByText('I turned off comfy-cushions.')
        ).toBeVisible()

        await expectElementScreenshot(card, 'agent-extension-change-card.png')
      }
    )
  }
)
