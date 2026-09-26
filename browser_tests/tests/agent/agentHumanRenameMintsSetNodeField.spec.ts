import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const NEW_TITLE = 'Renamed By Human'

test.describe(
  'A human canvas rename mints a set_node_field op',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('renaming a node from the canvas sends set_node_field, not just a local title change', async ({
      agentConversation
    }) => {
      test.setTimeout(60_000)

      await agentConversation.runTurns()

      await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)

      await expect(
        agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
      ).toContainText(NEW_TITLE)

      await expect
        .poll(() =>
          agentConversation
            .clientDocFrames()
            .filter((frame) => frame.type === 'doc_ops')
            .flatMap((frame) => frame.ops)
        )
        .toEqual([`set_node_field:${RENAMED_NODE_ID}`])
    })
  }
)
