import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * Known defect, pinned: a widget register is one last-writer-wins value, so
 * a remote frame that writes the widget a user is typing into rewinds the
 * textarea to the frame's value and the keystrokes typed since are lost.
 * Concurrent text needs a shared text type in the document vocabulary, not a
 * live-side guard.
 */
test.describe(
  'Agent widget value vs a remote frame',
  { tag: ['@cloud', '@widget', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: 'agent-rec-replace-prompt-encoder' })

    const NEW_NODE_ID = '4181654812796082'
    const APPENDED = ' at sunset, golden hour, cinematic lighting'

    test('typing into a prompt widget survives a doc frame that resyncs it right after the run', async ({
      agentConversation
    }) => {
      test.setTimeout(60_000)
      await agentConversation.runTurns()

      const field = agentConversation.vueNodes
        .getNodeLocator(NEW_NODE_ID)
        .getByLabel('text', { exact: true })
      await expect(field).toHaveValue('a photo of a pier')

      await field.click()
      await field.press('End')

      // Per-key dispatch so the frame lands between keystrokes, after some
      // of the appended text is already in the live value.
      const FIRST_CHUNK = APPENDED.slice(0, 5)
      const REST_CHUNK = APPENDED.slice(5)
      await field.pressSequentially(FIRST_CHUNK, { delay: 20 })

      const typing = field.pressSequentially(REST_CHUNK, { delay: 20 })
      void agentConversation.resyncWidget(NEW_NODE_ID, 'text')
      await typing

      const finalValue = await field.inputValue()
      await test.info().attach('typed-vs-final.txt', {
        body: `typed: a photo of a pier${APPENDED}\nfinal: ${finalValue}`,
        contentType: 'text/plain'
      })
      await test.info().attach('widget-after-race.png', {
        body: await agentConversation.vueNodes
          .getNodeLocator(NEW_NODE_ID)
          .screenshot(),
        contentType: 'image/png'
      })

      test.fail()
      await expect(field).toHaveValue(`a photo of a pier${APPENDED}`)
    })
  }
)
