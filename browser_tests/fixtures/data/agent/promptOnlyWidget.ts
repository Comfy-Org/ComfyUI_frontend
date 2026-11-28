import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

import type { NonValueWidgetRigConfig } from '@e2e/fixtures/agentNonValueWidgetRig'

export const PROMPT_ONLY_NODE_ID = 812
export const PROMPT_ONLY_EDITED_SEED = 24680
const initialSeed = 13579

const nodeType = 'KSampler'

const nodeDef: ComfyNodeDef = {
  name: nodeType,
  display_name: 'KSampler',
  description: '',
  category: 'sampling',
  python_module: 'nodes',
  output_node: false,
  input: {
    required: {
      seed: ['INT', { default: 0, min: 0, max: 2147483647 }],
      steps: ['INT', { default: 20, min: 1, max: 10000 }]
    }
  },
  output: ['LATENT'],
  output_is_list: [false],
  output_name: ['LATENT']
}

const catalog: WidgetCatalog = {
  types: { [nodeType]: { widget_order: ['seed', 'steps'] } }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: PROMPT_ONLY_NODE_ID,
      type: nodeType,
      pos: [0, 0],
      size: [270, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
      properties: {},
      widgets_values: [initialSeed, 20]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

export const promptOnlyWidgetRigConfig = {
  catalog,
  messageId: 'b8198e31-0000-4000-8000-000000000091',
  nodeDefs: { [nodeType]: nodeDef },
  samplerNodeId: PROMPT_ONLY_NODE_ID,
  seed,
  threadId: 'b8198e31-0000-4000-8000-000000000092',
  visibleNodeId: PROMPT_ONLY_NODE_ID,
  workflowId: 'b8198e31-0000-4000-8000-000000000090'
} satisfies NonValueWidgetRigConfig
