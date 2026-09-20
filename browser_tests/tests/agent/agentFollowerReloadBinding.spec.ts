import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A recording whose first turn adds nodes, so the canvas carries agent-authored
// state into the reload rather than only a transcript.
const CASE = 'agent-rec-add-set-delete'

// FE-1969: a restored page re-subscribes to the document it was already
// following. Before the conversation fixture could reload, this could only be
// pinned at the integration level, because the one reloading Agent spec
// (`agentChatRefreshPersistence`) runs with `connectWebSocketToServer: false`
// and therefore never subscribes to a document at all.
test.describe(
  'Agent follower rebinding after reload',
  { tag: '@cloud' },
  () => {
    test.use({ conversationCase: CASE })

    test('re-subscribes to the same document and keeps the agent nodes on the canvas', async ({
      agentConversation
    }) => {
      test.setTimeout(120_000)

      await agentConversation.runTurns()
      const addedIds = agentConversation.addedNodeIds()
      expect(addedIds.length).toBeGreaterThan(0)

      const subscribesBeforeReload = agentConversation.subscribeCount()

      await agentConversation.reload()

      // The rebind, not merely a completed navigation.
      expect(agentConversation.subscribeCount()).toBeGreaterThan(
        subscribesBeforeReload
      )

      // The restored canvas still renders what the agent built. A rebind that
      // dropped the document would leave these unmounted.
      for (const id of addedIds) {
        await expect(
          agentConversation.vueNodes.getNodeLocator(id)
        ).toBeVisible()
      }
    })
  }
)
