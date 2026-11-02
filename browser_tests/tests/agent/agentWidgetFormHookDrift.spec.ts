import { expect } from '@playwright/test'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const NODE_TYPE = 'AgentWidgetFormDriftProbe'

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Agent Widget Form Drift Probe',
  description: '',
  category: 'testing',
  python_module: 'browser_tests.agent_widget_form_drift',
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
  'Agent widget form under a third-party serializer',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      extraNodeDefs: { [NODE_TYPE]: nodeDef },
      humanOpsHost: 'apply'
    })

    test('ignores serializer-private positional state outside the Agent wire', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('bind the seeded workflow', async () => {
        await agentConversation.runTurns()
      })

      const control =
        await test.step('publish a node nothing interferes with', async () => {
          const nodeId = await agentConversation.addNodeOfType(
            NODE_TYPE,
            [400, 400]
          )
          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(outcomes[0]?.outcome).toBe('applied')
          expect(agentConversation.hostNode(nodeId)).toMatchObject({
            widgets_values: { text: 'initial value' },
            widgets_values_form: { order: ['text'] }
          })
          return nodeId
        })

      await test.step('install a pack that appends its own entry after the hook', async () => {
        await page.evaluate((type) => {
          const proto = window.LiteGraph!.registered_node_types[type].prototype
          proto.onSerialize = function (data) {
            data.widgets_values = ['initial value', 'pack private state']
          }
        }, NODE_TYPE)
      })

      await test.step('the node reaches the host with its named value and form', async () => {
        const nodeId = await agentConversation.addNodeOfType(
          NODE_TYPE,
          [700, 400]
        )
        expect(nodeId).not.toBe(control)

        const outcomes = await agentConversation.waitForHumanOps(2)
        expect(outcomes[1]).toMatchObject({
          outcome: 'applied'
        })
        expect(agentConversation.hostNode(nodeId)).toMatchObject({
          widgets_values: { text: 'initial value' },
          widgets_values_form: { order: ['text'] }
        })
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeVisible()
      })

      await test.step('the undrifted node remains intact', () => {
        expect(agentConversation.hostNode(control)).toMatchObject({
          widgets_values_form: { order: ['text'] }
        })
      })
    })
  }
)
