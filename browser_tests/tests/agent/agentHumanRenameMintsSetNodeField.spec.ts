import { expect } from '@playwright/test'

import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/** Every op this client has minted so far, in frame order, as `op:node_id`. */
function mintedOps(agentConversation: AgentConversationHarness): string[] {
  return agentConversation
    .clientDocFrames()
    .filter((frame) => frame.type === 'doc_ops')
    .flatMap((frame) => frame.ops)
}

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const NEW_TITLE = 'Renamed By Human'

// Renaming a node from the canvas while the Agent is bound has to reach the
// document, or the agent's next turn reasons about a node the user has already
// renamed and a reload that reprojects from the document loses the rename.
// `set_node_field` is the op for this; it is in the shared vocabulary's
// FROZEN_OPS (@comfyorg/comfy-multi-player), so the assertion is against the
// op layer's contract, not where the mint happens.
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

      // Only the ops minted from here on are this case's business.
      const opsBeforeRename = mintedOps(agentConversation).length

      await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)

      await expect(
        agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
      ).toContainText(NEW_TITLE)

      await expect
        .poll(() => mintedOps(agentConversation).slice(opsBeforeRename))
        .toEqual([`set_node_field:${RENAMED_NODE_ID}`])
    })
  }
)
