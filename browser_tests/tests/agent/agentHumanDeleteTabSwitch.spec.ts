import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const PROMPT_NODE_ID = '6'
const PROMPT_WIDGET = 'text'
const FIRST_DELETED_NODE_ID = '3'
const SECOND_DELETED_NODE_ID = '8'
const UNAFFECTED_NODE_IDS = ['4', '6', '9']

test.describe(
  'Human-deleted nodes across a workflow tab switch with Agent bound',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'hold' })

    test('keeps two deletions suppressed while the second waits behind an unacknowledged first deletion', async ({
      agentConversation
    }, testInfo) => {
      test.setTimeout(90_000)

      await agentConversation.runTurns()
      await agentConversation.installTabSwitchObserver()

      await agentConversation.vueNodes.deleteNode(FIRST_DELETED_NODE_ID)
      await expect(
        agentConversation.vueNodes.getNodeLocator(FIRST_DELETED_NODE_ID)
      ).toBeHidden()
      await expect
        .poll(() =>
          agentConversation
            .clientDocFrames()
            .filter((frame) => frame.type === 'doc_ops')
            .map((frame) => frame.ops)
        )
        .toEqual([[`delete_node:${FIRST_DELETED_NODE_ID}`]])

      await agentConversation.vueNodes.deleteNode(SECOND_DELETED_NODE_ID)
      await expect(
        agentConversation.vueNodes.getNodeLocator(SECOND_DELETED_NODE_ID)
      ).toBeHidden()
      await expect
        .poll(
          () =>
            agentConversation
              .clientDocFrames()
              .filter((frame) => frame.type === 'doc_ops').length
        )
        .toBe(1)

      await agentConversation.attachEvidence(testInfo, 'before-switch')
      await agentConversation.switchAwayAndBack(PROMPT_NODE_ID, PROMPT_WIDGET)

      const after = await agentConversation.attachEvidence(
        testInfo,
        'after-return'
      )
      await expect(
        agentConversation.vueNodes.getNodeLocator(FIRST_DELETED_NODE_ID)
      ).toBeHidden()
      await expect(
        agentConversation.vueNodes.getNodeLocator(SECOND_DELETED_NODE_ID)
      ).toBeHidden()
      await expect(
        agentConversation.vueNodes.getNodeLocator(UNAFFECTED_NODE_IDS[0])
      ).toBeVisible()
      await expect(
        agentConversation.vueNodes.getNodeLocator(UNAFFECTED_NODE_IDS[1])
      ).toBeVisible()
      await expect(
        agentConversation.vueNodes.getNodeLocator(UNAFFECTED_NODE_IDS[2])
      ).toBeVisible()
      expect(after.live).toEqual(expect.arrayContaining(UNAFFECTED_NODE_IDS))
      expect(after.live).not.toContain(FIRST_DELETED_NODE_ID)
      expect(after.live).not.toContain(SECOND_DELETED_NODE_ID)
      expect(after.serialized).toEqual(
        expect.arrayContaining(UNAFFECTED_NODE_IDS)
      )
      expect(after.serialized).not.toContain(FIRST_DELETED_NODE_ID)
      expect(after.serialized).not.toContain(SECOND_DELETED_NODE_ID)
      expect(after.activeState).toEqual(
        expect.arrayContaining(UNAFFECTED_NODE_IDS)
      )
      expect(after.activeState).not.toContain(FIRST_DELETED_NODE_ID)
      expect(after.activeState).not.toContain(SECOND_DELETED_NODE_ID)
    })
  }
)
