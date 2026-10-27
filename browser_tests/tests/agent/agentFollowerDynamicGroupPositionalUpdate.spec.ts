import { expect } from '@playwright/test'

import type { WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

const NODE_TYPE = 'AgentFollowerDynamicGroupProbe'

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Agent Follower Dynamic Group Probe',
  description: '',
  category: 'testing',
  python_module: 'browser_tests.agent_follower_dynamic_group',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['rows'],
  input: {
    required: {
      before: ['STRING', { default: 'head' }],
      loras: [
        'COMFY_DYNAMICGROUP_V3',
        {
          min: 0,
          max: 3,
          group_name: 'LoRA',
          template: {
            required: {
              lora_name: [
                'COMBO',
                {
                  options: ['A.safetensors', 'B.safetensors', 'C.safetensors']
                }
              ],
              strength: ['FLOAT', { default: 1, min: 0, max: 1, step: 0.1 }],
              enabled: ['BOOLEAN', { default: true }]
            }
          }
        }
      ],
      after: ['STRING', { default: 'tail' }]
    }
  },
  input_order: { required: ['before', 'loras', 'after'] }
}

test.describe(
  'an Agent follower positional widget update',
  { tag: ['@cloud', '@agent', '@widget', '@vue-nodes'] },
  () => {
    test('grows an existing DynamicGroup and preserves row and trailing widget values on the visible canvas', async ({
      page,
      agentFlagEnabled
    }) => {
      const workflowId = '8e3e2af4-7b72-4ea0-9205-5a3199bcf251'
      const nodeId = 501
      const seed: WorkflowJSON = {
        nodes: [
          {
            id: nodeId,
            type: NODE_TYPE,
            pos: [0, 0],
            size: [350, 300],
            flags: {},
            order: 0,
            mode: 0,
            inputs: [],
            outputs: [{ name: 'rows', type: 'STRING', links: [] }],
            properties: {},
            widgets_values: [
              'head',
              2,
              'A.safetensors',
              0.1,
              true,
              'B.safetensors',
              0.2,
              false,
              'tail'
            ]
          }
        ],
        links: [],
        groups: [],
        config: {},
        extra: {},
        version: 0.4
      }
      const host = new HostDoc(workflowId, seed, { types: {} })
      const hostSocket = new AgentFollowerHostSocket(page, workflowId, host)
      await hostSocket.install()

      await bootAgentApp(page, agentFlagEnabled, {
        objectInfo: { [NODE_TYPE]: nodeDef },
        settings: { 'Comfy.Graph.CanvasInfo': false },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            thread_id: 'a4cd869f-13b4-4fc5-bae6-83676868766f',
            message_id: '665c4c38-f29f-4f84-9b78-b84228336a70',
            workflow_id: workflowId
          })
          await mockWorkflowPersistence(page, workflowId)
        }
      })

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Inspect the workflow')
      await hostSocket.waitForSubscribe()

      const node = new VueNodeHelpers(page).getNodeLocator(String(nodeId))
      const rowNames = node.getByRole('combobox', {
        name: /^LoRA #\d+ lora_name$/
      })
      await expect(node).toBeVisible()
      await expect(rowNames).toHaveText(['A.safetensors', 'B.safetensors'])
      await expect(node.getByLabel('after', { exact: true })).toHaveValue(
        'tail'
      )

      hostSocket.send(
        host.replaceOpaqueWidgetValues(nodeId, [
          'head',
          3,
          'A.safetensors',
          0.1,
          true,
          'B.safetensors',
          0.2,
          false,
          'C.safetensors',
          0.3,
          true,
          'tail'
        ])
      )

      await expect(rowNames).toHaveText([
        'A.safetensors',
        'B.safetensors',
        'C.safetensors'
      ])
      await expect(
        node
          .getByRole('group', { name: 'LoRA #1', exact: true })
          .getByRole('spinbutton')
      ).toHaveValue('0.1')
      await expect(
        node
          .getByRole('group', { name: 'LoRA #2', exact: true })
          .getByRole('spinbutton')
      ).toHaveValue('0.2')
      await expect(
        node
          .getByRole('group', { name: 'LoRA #3', exact: true })
          .getByRole('spinbutton')
      ).toHaveValue('0.3')
      await expect(node.getByLabel('after', { exact: true })).toHaveValue(
        'tail'
      )
    })
  }
)
