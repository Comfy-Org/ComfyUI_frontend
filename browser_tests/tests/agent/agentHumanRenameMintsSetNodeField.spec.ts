import { expect } from '@playwright/test'

import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * Every op this client has minted so far, in frame order, reduced to the four
 * fields this pin is about. Deliberately not the `op:node_id` label the fixture
 * also exposes: that collapses the payload away, so a `set_node_field` on the
 * right node carrying `field: 'mode'`, or the wrong title, would satisfy it —
 * and the mint under test is described as covering title *and mode* changes,
 * which is exactly where that confusion would land.
 */
function mintedFieldOps(agentConversation: AgentConversationHarness) {
  return agentConversation
    .clientDocFrames()
    .filter((frame) => frame.type === 'doc_ops')
    .flatMap((frame) => frame.opPayloads)
    .map(({ op, node_id, field, value }) => ({
      op,
      node_id: String(node_id),
      field,
      value
    }))
}

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const NEW_TITLE = 'Renamed By Human'

// Renaming a node from the canvas while the Agent is bound changes the title
// locally and sends nothing: the document keeps the old title, so the agent's
// next turn reasons about a node the user has already renamed, and a reload
// that reprojects from the document loses the rename outright.
//
// `set_node_field` is the op for this. It is in the shared vocabulary's
// FROZEN_OPS (@comfyorg/comfy-multi-player), so the name here is the op
// layer's, not this repo's plumbing — the pin survives the remote-apply
// refactor moving where the mint happens.
//
// Extracted from FE #18283 (`feat: mint set_node_field for local title and
// mode changes`), whose code half mints from a store side effect and stays
// parked for the pivot (Linear FE-2504, landing on FE #18700). Pinned with
// `test.fail()` so the gap is recorded now and minting flips this to passing.
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

      // Only the ops minted from here on are this case's business. Comparing
      // the whole collected list would make the assertion order-dependent on
      // anything the turn itself mints, and — worse for a `test.fail()` pin —
      // could keep classifying a working rename as an expected failure.
      const opsBeforeRename = mintedFieldOps(agentConversation).length

      await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)

      // The local half already works, and a failure here is a different
      // defect (the canvas title editor itself) from the one pinned below.
      // test.fail() only reclassifies what is thrown after it.
      await expect(
        agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
      ).toContainText(NEW_TITLE)

      test.fail()

      // One assertion, not two: inside a `test.fail()` body the first failing
      // expect aborts the rest, so a follow-up payload check would be dead
      // code in exactly the state this pin describes.
      await expect
        .poll(() => mintedFieldOps(agentConversation).slice(opsBeforeRename))
        .toEqual([
          {
            op: 'set_node_field',
            node_id: RENAMED_NODE_ID,
            field: 'title',
            value: NEW_TITLE
          }
        ])
    })
  }
)
