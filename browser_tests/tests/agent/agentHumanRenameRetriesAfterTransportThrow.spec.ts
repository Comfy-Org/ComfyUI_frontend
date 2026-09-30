import { expect } from '@playwright/test'

import { agentConversationTest } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const READINESS_NODE_ID = '6'
const READINESS_WIDGET = 'text'
const NEW_TITLE = 'Rename Survives Transport Retry'

const test = agentConversationTest.extend<{ throwFirstHumanOpsSend: void }>({
  throwFirstHumanOpsSend: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        const nativeSend = WebSocket.prototype.send
        let throwsLeft = 1
        WebSocket.prototype.send = function (
          data: Parameters<WebSocket['send']>[0]
        ) {
          let isHumanOps = false
          if (typeof data === 'string') {
            try {
              const frame: unknown = JSON.parse(data)
              isHumanOps =
                typeof frame === 'object' &&
                frame !== null &&
                'type' in frame &&
                frame.type === 'doc_ops'
            } catch {
              // Non-JSON WebSocket traffic is unrelated to this fault.
            }
          }
          if (isHumanOps && throwsLeft > 0) {
            throwsLeft--
            throw new Error('injected doc_ops transport failure')
          }
          nativeSend.call(this, data)
        }
      })
      await use()
    },
    { auto: true }
  ]
})

test.describe(
  'Human graph edits after an Agent transport failure',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps a renamed node after the first doc_ops send throws and the user switches tabs', async ({
      agentConversation
    }) => {
      test.setTimeout(60_000)
      await agentConversation.runTurns()

      await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)
      const renamedNode =
        agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
      await expect(renamedNode).toContainText(NEW_TITLE)

      await agentConversation.waitForHumanOps(1)
      expect(
        agentConversation
          .clientDocFrames()
          .filter((frame) => frame.type === 'doc_ops')
      ).toHaveLength(1)

      await agentConversation.switchAwayAndBack(
        READINESS_NODE_ID,
        READINESS_WIDGET
      )
      await expect(renamedNode).toContainText(NEW_TITLE)
    })
  }
)
