import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Finished generation reply link',
  { tag: ['@cloud', '@agent', '@panel', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-asset-url-reply' })

    test('shows the recorded output as a usable link in the agent reply', async ({
      agentConversation
    }) => {
      await agentConversation.runTurns()

      const resultLink = agentConversation.panel.getByRole('link', {
        name: /ComfyUI_00001_32f6b8c7\.png/
      })
      await expect(resultLink).toBeVisible()
      await expect(resultLink).toHaveAttribute(
        'href',
        /\/api\/view\?filename=ComfyUI_00001_32f6b8c7\.png&subfolder=agent%2Foutputs&type=output$/
      )
    })
  }
)
