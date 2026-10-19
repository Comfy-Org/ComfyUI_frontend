import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  AGENT_WIDGET_FORM_NODE_TYPE,
  agentWidgetFormNodeDef
} from '@e2e/fixtures/data/agentWidgetFormNodeDef'

test.describe(
  'Agent widget form round trip',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      extraNodeDefs: {
        [AGENT_WIDGET_FORM_NODE_TYPE]: agentWidgetFormNodeDef
      },
      humanOpsHost: 'apply'
    })

    test('persists and restores an uncatalogued frontend widget', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await test.step('bind the seeded workflow', async () => {
        await agentConversation.runTurns()
      })

      const nodeId =
        await test.step('add the uncatalogued node and publish its widget', async () => {
          const nodeId = await agentConversation.addNodeOfType(
            AGENT_WIDGET_FORM_NODE_TYPE,
            [400, 400]
          )
          await expect(
            agentConversation.vueNodes.getNodeLocator(nodeId)
          ).toBeVisible()

          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(outcomes).toHaveLength(1)
          expect(outcomes[0]?.outcome).toBe('applied')
          expect(agentConversation.hostWidgetValue(nodeId, 'text')).toBe(
            'initial value'
          )
          expect(agentConversation.hostNode(nodeId)).toMatchObject({
            widgets_values: { text: 'initial value' },
            widgets_values_form: { order: ['text'] }
          })

          return nodeId
        })

      await test.step('restore the widget after returning to the tab', async () => {
        await agentConversation.switchAwayAndBack(nodeId, 'text')
      })
    })
  }
)
