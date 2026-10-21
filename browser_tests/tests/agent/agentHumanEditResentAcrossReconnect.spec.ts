import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const NEW_TITLE = 'Rename Survives Reconnect'

test.describe(
  'A human edit resent across a reconnect',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test(
      'keeps a rename lost in transit when the app reconnects with a new session id before the resend',
      {
        annotation: {
          type: 'regression',
          description:
            'https://github.com/Comfy-Org/ComfyUI_frontend/pull/20883#discussion_r4330424181'
        }
      },
      async ({ agentConversation, page }) => {
        test.setTimeout(60_000)
        await agentConversation.runTurns()
        const sessionBefore = await page.evaluate(
          () => window.app!.api.clientId
        )
        const framesBefore = agentConversation.humanOpFrames().length
        const outcomesBefore = agentConversation.humanOpOutcomes().length

        agentConversation.leaveNextHumanBatchUnanswered()
        await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)
        const renamedNode =
          agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
        await expect(renamedNode).toContainText(NEW_TITLE)
        await expect
          .poll(() => agentConversation.humanOpFrames().length, {
            message: 'the first send goes out on the old session'
          })
          .toBe(framesBefore + 1)

        await agentConversation.disconnectComfySocket()
        await expect
          .poll(() => page.evaluate(() => window.app!.api.clientId), {
            message: 'the app is on a new session'
          })
          .not.toBe(sessionBefore)

        await expect
          .poll(() => agentConversation.humanOpFrames().length, {
            message: 'the sender resends after its result timeout',
            timeout: 20_000
          })
          .toBe(framesBefore + 2)
        const [sent, resent] = agentConversation
          .humanOpFrames()
          .slice(framesBefore)
        expect(resent.opIds).toEqual(sent.opIds)
        expect(resent.tab).toBe(sent.tab)
        expect(resent.writers).toEqual(sent.writers)
        expect(resent.comfyConnection).toBeGreaterThan(sent.comfyConnection)

        await agentConversation.waitForHumanOps(outcomesBefore + 1)
        await expect
          .poll(() => agentConversation.hostNode(RENAMED_NODE_ID)?.title)
          .toBe(NEW_TITLE)
        await expect(renamedNode).toContainText(NEW_TITLE)
      }
    )
  }
)
