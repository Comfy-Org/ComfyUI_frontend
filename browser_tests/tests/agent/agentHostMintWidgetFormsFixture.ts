import type { Locator } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

import { AgentNonValueWidgetRig } from '@e2e/fixtures/agentNonValueWidgetRig'
import { agentTest } from '@e2e/fixtures/agentPanelFixture'

const PREVIEW_TYPE = 'PreviewAny'
export const PREVIEW_NODE_ID = 711
const COMBO_TYPE = 'CustomCombo'
export const COMBO_NODE_ID = 712
const WORKFLOW_ID = 'd5f3e6c4-0000-4000-8000-000000000080'
const MESSAGE_ID = 'd5f3e6c4-0000-4000-8000-000000000081'
const THREAD_ID = 'd5f3e6c4-0000-4000-8000-000000000082'

const previewNodeDef: ComfyNodeDef = {
  name: PREVIEW_TYPE,
  display_name: 'Preview as Text',
  description: '',
  category: 'utilities',
  python_module: 'comfy_extras.nodes_preview_any',
  output_node: true,
  input: { required: { source: ['*', {}] } },
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING']
}

const comboNodeDef: ComfyNodeDef = {
  name: COMBO_TYPE,
  display_name: 'Custom Combo',
  description: '',
  category: 'utilities',
  python_module: 'comfy_extras.nodes_logic',
  output_node: false,
  input: {
    required: {
      choice: ['COMBO', { multiselect: false, options: [] }]
    }
  },
  output: ['STRING', 'INT'],
  output_is_list: [false, false],
  output_name: ['STRING', 'INDEX']
}

const catalog: WidgetCatalog = {
  types: {
    [PREVIEW_TYPE]: { widget_order: [] },
    [COMBO_TYPE]: { widget_order: ['choice'] }
  }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: PREVIEW_NODE_ID,
      type: PREVIEW_TYPE,
      pos: [40, 60],
      size: [270, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [{ name: 'source', type: '*', link: null }],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: []
    },
    {
      id: COMBO_NODE_ID,
      type: COMBO_TYPE,
      pos: [380, 60],
      size: [300, 320],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [
        {
          name: 'choice',
          type: 'COMBO',
          widget: { name: 'choice' },
          link: null
        }
      ],
      outputs: [
        { name: 'STRING', type: 'STRING', links: [] },
        { name: 'INDEX', type: 'INT', links: [] }
      ],
      properties: {},
      widgets_values: ['first', 0, 'first', 'second', 'third', ''],
      widgets_values_form: {
        order: ['choice', 'index', 'option1', 'option2', 'option3', 'option4']
      }
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

interface HostMintWidgetForms {
  combo: Locator
  missingWidgetReports: string[]
  preview: Locator
  rig: AgentNonValueWidgetRig
}

export const hostMintWidgetFormsTest = agentTest.extend<{
  hostMintWidgetForms: HostMintWidgetForms
}>({
  hostMintWidgetForms: async ({ page }, use) => {
    const missingWidgetReports: string[] = []
    page.on('console', (message) => {
      if (/\bagent_graph_widget_missing(?!\w)/.test(message.text()))
        missingWidgetReports.push(message.text())
    })

    const rig = await AgentNonValueWidgetRig.boot(page, {
      catalog,
      messageId: MESSAGE_ID,
      nodeDefs: {
        [PREVIEW_TYPE]: previewNodeDef,
        [COMBO_TYPE]: comboNodeDef
      },
      samplerNodeId: COMBO_NODE_ID,
      seed,
      threadId: THREAD_ID,
      visibleNodeId: PREVIEW_NODE_ID,
      workflowId: WORKFLOW_ID
    })

    await use({
      combo: rig.vueNodes.getNodeLocator(String(COMBO_NODE_ID)),
      missingWidgetReports,
      preview: rig.vueNodes.getNodeLocator(String(PREVIEW_NODE_ID)),
      rig
    })
  }
})
