import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Finished generation reply link',
  { tag: ['@cloud', '@agent', '@panel', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-asset-url-reply' })

    test('shows the recorded output as a usable link in the agent reply', async ({
      agentConversation,
      page
    }) => {
      await agentConversation.runTurns()

      const resultLink = agentConversation.panel.getByRole('link', {
        name: /ComfyUI_00001_32f6b8c7\.png/
      })
      await expect(resultLink).toBeVisible()

      // The recording hands the panel an absolute
      // https://cloud.comfy.org/api/view href. Matching only the tail of it
      // would keep passing if that origin were rendered verbatim, which is the
      // regression a "usable link" case has to catch, so resolve the href and
      // pin that it was rebased onto the origin actually serving the page.
      const href = await resultLink.getAttribute('href')
      expect(href).not.toBeNull()
      const resolved = new URL(href!, page.url())
      expect(resolved.origin).toBe(new URL(page.url()).origin)
      expect(`${resolved.pathname}${resolved.search}`).toBe(
        '/api/view?filename=ComfyUI_00001_32f6b8c7.png&subfolder=agent%2Foutputs&type=output'
      )
    })
  }
)
