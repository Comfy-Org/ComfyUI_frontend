import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

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

const DROP_NODE_TYPE = 'AgentWidgetFormDropProbe'

const dropNodeDef: ComfyNodeDef = {
  ...nodeDef,
  name: DROP_NODE_TYPE,
  display_name: 'Agent Widget Form Drop Probe',
  input: {
    required: {
      text: ['STRING', { default: 'initial value', multiline: false }],
      count: ['INT', { default: 3, min: 0, max: 10 }]
    }
  },
  input_order: { required: ['text', 'count'] }
}

test.describe(
  'Agent widget form under a third-party serializer',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      extraNodeDefs: { [NODE_TYPE]: nodeDef, [DROP_NODE_TYPE]: dropNodeDef },
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

    test('refuses the add when the serializer drops a named value', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      test.setTimeout(90_000)

      await test.step('bind the seeded workflow', async () => {
        await agentConversation.runTurns()
      })

      const control =
        await test.step('a node nothing interferes with carries both names', async () => {
          const nodeId = await agentConversation.addNodeOfType(
            DROP_NODE_TYPE,
            [400, 400]
          )
          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(outcomes[0]?.outcome).toBe('applied')
          expect(agentConversation.hostNode(nodeId)).toMatchObject({
            widgets_values: { text: 'initial value', count: 3 },
            widgets_values_form: { order: ['text', 'count'] }
          })
          return nodeId
        })

      await test.step('install a pack whose serializer drops one named value', async () => {
        await page.evaluate((type) => {
          const proto = window.LiteGraph!.registered_node_types[type].prototype
          proto.onSerialize = function (data) {
            const named = data.widgets_values_named
            if (!named) return
            const kept = { ...named }
            Reflect.deleteProperty(kept, 'count')
            data.widgets_values_named = kept
          }
        }, DROP_NODE_TYPE)
      })

      const drifted =
        await test.step('the host refuses the add rather than taking an unproven form', async () => {
          const nodeId = await agentConversation.addNodeOfType(
            DROP_NODE_TYPE,
            [700, 400]
          )
          const outcomes = await agentConversation.waitForHumanOps(2)
          expect(
            outcomes.filter((outcome) => outcome.outcome === 'rejected')
          ).toMatchObject([{ reason: { code: 'uncatalogued_widget_write' } }])
          expect(agentConversation.hostNode(nodeId)).toBeUndefined()
          expect(agentConversation.hostNode(control)).toBeDefined()
          return nodeId
        })

      await test.step('the person is told the edit was refused', async () => {
        await expect(
          comfyPage.toast.withText(
            `${enMessages.agent.editRejected.generic} Rejected: ${DROP_NODE_TYPE} (uncatalogued_widget_write)`
          )
        ).toBeVisible({ timeout: 10_000 })
      })

      await test.step('the refused node leaves the canvas and the control stays', async () => {
        await expect(
          agentConversation.vueNodes.getNodeLocator(drifted)
        ).toHaveCount(0)
        await expect
          .poll(() =>
            page.evaluate(
              (id) =>
                window.app!.graph.nodes.some((node) => String(node.id) === id),
              drifted
            )
          )
          .toBe(false)
        await expect(
          agentConversation.vueNodes.getNodeLocator(control)
        ).toBeVisible()
        expect(
          await page.evaluate(
            (id) =>
              window.app!.graph.nodes.some((node) => String(node.id) === id),
            control
          )
        ).toBe(true)
      })
    })
  }
)
