import { expect } from '@playwright/test'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const NODE_TYPE = 'AgentWidgetFormProbe'

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Agent Widget Form Probe',
  description: '',
  category: 'testing',
  python_module: 'browser_tests.agent_widget_form',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['text'],
  input: {
    required: {
      text: ['STRING', { default: 'initial value', multiline: false }]
    }
  },
  input_order: { required: ['text'] }
}

test.describe(
  'Agent widget form round trip',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      extraNodeDefs: { [NODE_TYPE]: nodeDef },
      humanOpsHost: 'apply'
    })

    test('persists and restores a node the host catalog does not list', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await test.step('bind the seeded workflow', async () => {
        await agentConversation.runTurns()
      })

      const nodeId =
        await test.step('add the uncatalogued node and publish its widget', async () => {
          const nodeId = await agentConversation.addNodeOfType(
            NODE_TYPE,
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

      const savedValue = 'saved before tab switch'

      await test.step('save a non-default widget value', async () => {
        const textField = agentConversation.vueNodes
          .getNodeLocator(nodeId)
          .getByLabel('text', { exact: true })
        await textField.fill(savedValue)
        await textField.press('Tab')

        const outcomes = await agentConversation.waitForHumanOps(2)
        expect(outcomes[1]?.outcome).toBe('applied')
        await expect
          .poll(() => agentConversation.hostWidgetValue(nodeId, 'text'))
          .toBe(savedValue)
      })

      await test.step('restore the widget after returning to the tab', async () => {
        await agentConversation.switchAwayAndBack(nodeId, 'text', savedValue)
      })
    })
  }
)
