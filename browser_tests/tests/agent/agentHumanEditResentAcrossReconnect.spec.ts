import { expect } from '@playwright/test'

import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const NEW_TITLE = 'Rename Survives Reconnect'

function humanOpFrames(agentConversation: AgentConversationHarness) {
  return agentConversation
    .clientDocFrames()
    .filter((frame) => frame.type === 'doc_ops')
}

// Source: review of FE #20883
// (https://github.com/Comfy-Org/ComfyUI_frontend/pull/20883#discussion_r4330424181).
// Cloud ingest mints a new session id on every /ws reconnect, and the app
// copies it into `api.clientId`. The agent refuses a doc_ops batch whose ops
// claim any writer other than human:<user>:<frame tab>. The actor is minted
// once and the tab is read on every send, so both must come from one id that
// outlives a reconnect, or a resend after a reconnect is refused and the edit
// is reverted.
test.describe(
  'A human edit resent across a reconnect',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps a rename whose result was lost when the app reconnects with a new session id before the resend', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(60_000)
      await agentConversation.runTurns()
      const sessionBefore = await page.evaluate(() => window.app!.api.clientId)
      const framesBefore = humanOpFrames(agentConversation).length
      const outcomesBefore = agentConversation.humanOpOutcomes().length

      agentConversation.leaveNextHumanBatchUnanswered()
      await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)
      const renamedNode =
        agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
      await expect(renamedNode).toContainText(NEW_TITLE)
      // Setup checkpoint: the first send went out on the old session.
      await expect
        .poll(() => humanOpFrames(agentConversation).length)
        .toBe(framesBefore + 1)

      await agentConversation.reconnectComfySocket()
      // Setup checkpoint: the app really is on a new session.
      await expect
        .poll(() => page.evaluate(() => window.app!.api.clientId))
        .not.toBe(sessionBefore)

      // The sender resends the same ops after its result timeout.
      await expect
        .poll(() => humanOpFrames(agentConversation).length, {
          timeout: 20_000
        })
        .toBe(framesBefore + 2)
      const [sent, resent] =
        humanOpFrames(agentConversation).slice(framesBefore)
      expect(resent.opIds).toEqual(sent.opIds)

      await agentConversation.waitForHumanOps(outcomesBefore + 1)
      await expect
        .poll(() => agentConversation.hostNode(RENAMED_NODE_ID)?.title)
        .toBe(NEW_TITLE)
      await expect(renamedNode).toContainText(NEW_TITLE)
    })
  }
)
