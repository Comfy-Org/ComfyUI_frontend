import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const NEW_TITLE = 'Rename Survives Reconnect'

// Source: review of FE #20883
// (https://github.com/Comfy-Org/ComfyUI_frontend/pull/20883#discussion_r4330424181).
// Cloud ingest mints a new websocket session id on every reconnect. The host
// refuses a batch whose ops claim any writer other than human:<user>:<frame
// tab>, so a rename made while the connection is down must still be accepted
// when its retry goes out on the new connection.
test.describe(
  'A human edit retried across a reconnect',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps a rename made while the connection is down after the app reconnects with a new session id', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(60_000)
      await agentConversation.runTurns()
      const sessionBefore = await page.evaluate(() => window.app!.api.clientId)

      await agentConversation.dropConnection()
      await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)
      const renamedNode =
        agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
      await expect(renamedNode).toContainText(NEW_TITLE)

      // Setup checkpoint: the app really is on a new session.
      await expect
        .poll(() => page.evaluate(() => window.app!.api.clientId))
        .not.toBe(sessionBefore)

      await agentConversation.waitForHumanOps(1)
      await expect
        .poll(() => agentConversation.hostNode(RENAMED_NODE_ID)?.title)
        .toBe(NEW_TITLE)
      await expect(renamedNode).toContainText(NEW_TITLE)
    })
  }
)
