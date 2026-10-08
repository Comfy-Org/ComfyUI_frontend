import { expect } from '@playwright/test'

import { agentConversationTest } from '@e2e/fixtures/agentConversationFixture'
import {
  INJECTED_DOC_OPS_THROWS_ATTR,
  throwOnFirstDocOpsSend
} from '@e2e/fixtures/utils/throwOnFirstDocOpsSend'

const CASE = 'agent-rec-text-only-answer'
const RENAMED_NODE_ID = '4'
const READINESS_NODE_ID = '6'
const READINESS_WIDGET = 'text'
const NEW_TITLE = 'Rename Survives Transport Retry'

const test = agentConversationTest.extend<{ throwFirstHumanOpsSend: void }>({
  throwFirstHumanOpsSend: [
    async ({ page }, use) => {
      await throwOnFirstDocOpsSend(page)
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
      agentConversation,
      page
    }) => {
      test.setTimeout(60_000)
      await agentConversation.runTurns()

      await agentConversation.vueNodes.renameNode(RENAMED_NODE_ID, NEW_TITLE)
      const renamedNode =
        agentConversation.vueNodes.getNodeLocator(RENAMED_NODE_ID)
      await expect(renamedNode).toContainText(NEW_TITLE)

      await agentConversation.waitForHumanOps(1)
      await expect(page.locator('html')).toHaveAttribute(
        INJECTED_DOC_OPS_THROWS_ATTR,
        '1'
      )
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
