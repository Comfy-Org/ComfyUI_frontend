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

    test('declares no widget form for a node whose values a pack rewrites after serialization', async ({
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
        // The shape third-party packs actually use: an `onSerialize` that
        // appends private state to the positional array. It runs AFTER core
        // wrote `widgets_values` from the live widget list, and
        // `runExtensionSerializeHook` copies it back because the field is
        // canonical — so the order core derived no longer describes the
        // values any other reader of this workflow will see.
        await page.evaluate((type) => {
          const proto = window.LiteGraph!.registered_node_types[type].prototype
          proto.onSerialize = function (data) {
            data.widgets_values = ['initial value', 'pack private state']
          }
        }, NODE_TYPE)
      })

      await test.step('the drifted node reaches the host with no form, and is refused', async () => {
        const nodeId = await agentConversation.addNodeOfType(
          NODE_TYPE,
          [700, 400]
        )
        expect(nodeId).not.toBe(control)

        const outcomes = await agentConversation.waitForHumanOps(2)
        // Fail closed: with no form this class is uncatalogued, so the host
        // refuses the write instead of storing an order nobody proved.
        expect(outcomes[1]).toMatchObject({
          outcome: 'rejected',
          reason: { code: 'uncatalogued_widget_write' }
        })
        expect(agentConversation.hostNode(nodeId)).toBeUndefined()
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeHidden()
      })

      await test.step('the undrifted node is untouched by the refusal', () => {
        expect(agentConversation.hostNode(control)).toMatchObject({
          widgets_values_form: { order: ['text'] }
        })
      })
    })
  }
)
