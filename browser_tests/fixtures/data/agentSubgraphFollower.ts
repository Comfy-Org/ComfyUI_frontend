import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'
import * as Y from 'yjs'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import subgraphWorkflow from '@e2e/assets/subgraphs/subgraph-with-promoted-text-widget.json' with { type: 'json' }

export const AGENT_SUBGRAPH_WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'
export const AGENT_SUBGRAPH_HOST_ID = 11
export const AGENT_SUBGRAPH_LINK_ID = 21
export const AGENT_SUBGRAPH_INITIAL_TEXT = ''
export const AGENT_SUBGRAPH_EDITED_TEXT = 'edited prompt'

export const agentSubgraphNodeDefs: Record<string, ComfyNodeDef> = {
  AgentClipSource: {
    name: 'AgentClipSource',
    display_name: 'Agent Clip Source',
    description: '',
    category: 'testing',
    python_module: 'testing',
    output_node: false,
    input: { required: {} },
    output: ['CLIP'],
    output_is_list: [false],
    output_name: ['CLIP']
  },
  CLIPTextEncode: {
    name: 'CLIPTextEncode',
    display_name: 'CLIP Text Encode',
    description: '',
    category: 'conditioning',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        clip: ['CLIP', { forceInput: true }],
        text: ['STRING', { default: '', multiline: true }]
      }
    },
    output: ['CONDITIONING'],
    output_is_list: [false],
    output_name: ['CONDITIONING']
  },
  KSampler: {
    name: 'KSampler',
    display_name: 'KSampler',
    description: '',
    category: 'sampling',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        model: ['MODEL', { forceInput: true }],
        positive: ['CONDITIONING', { forceInput: true }],
        negative: ['CONDITIONING', { forceInput: true }],
        latent_image: ['LATENT', { forceInput: true }],
        seed: ['INT', { default: 0, min: 0, max: 2147483647 }],
        control_after_generate: [
          ['fixed', 'increment', 'decrement', 'randomize'],
          { default: 'randomize' }
        ],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        cfg: ['FLOAT', { default: 8, min: 0, max: 100 }],
        sampler_name: [['euler'], { default: 'euler' }],
        scheduler: [['simple'], { default: 'simple' }],
        denoise: ['FLOAT', { default: 1, min: 0, max: 1 }]
      }
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['LATENT']
  }
}

const catalog: WidgetCatalog = {
  types: {
    AgentClipSource: { widget_order: [] },
    CLIPTextEncode: { widget_order: ['text'] },
    KSampler: {
      widget_order: [
        'seed',
        'control_after_generate',
        'steps',
        'cfg',
        'sampler_name',
        'scheduler',
        'denoise'
      ]
    }
  }
}

const initialOps = [
  {
    op_id: '11111111111111111111111111111111',
    actor: 'agent:e2e',
    base_version: 1,
    stamp: [1, 'agent:e2e'],
    op: 'add_node',
    node_id: 20,
    class_type: 'AgentClipSource',
    pos: [40, 300],
    node: {
      id: 20,
      type: 'AgentClipSource',
      pos: [40, 300],
      size: [180, 80],
      inputs: [],
      outputs: [{ name: 'CLIP', type: 'CLIP', links: [] }]
    }
  },
  {
    op_id: '22222222222222222222222222222222',
    actor: 'agent:e2e',
    base_version: 2,
    stamp: [2, 'agent:e2e'],
    op: 'connect',
    link_id: AGENT_SUBGRAPH_LINK_ID,
    from_node: 20,
    from_slot: 0,
    to_node: AGENT_SUBGRAPH_HOST_ID,
    to_slot: 0,
    link_type: 'CLIP'
  }
] satisfies Op[]

const followUpOp = {
  op_id: '44444444444444444444444444444444',
  actor: 'agent:e2e',
  base_version: 4,
  stamp: [4, 'agent:e2e'],
  op: 'set_widget',
  node_id: AGENT_SUBGRAPH_HOST_ID,
  widget: 'text',
  value: AGENT_SUBGRAPH_EDITED_TEXT,
  old: AGENT_SUBGRAPH_INITIAL_TEXT,
  promoted: {
    instance_path: [AGENT_SUBGRAPH_HOST_ID],
    value_index: 0,
    host_widgets_values: [AGENT_SUBGRAPH_INITIAL_TEXT]
  }
} satisfies Op

function updateBase64(update: Uint8Array): string {
  return Buffer.from(update).toString('base64')
}

export function agentSubgraphUpdates(): {
  initial: string
  followUp: string
} {
  const host = mint(subgraphWorkflow, catalog)
  const initialResult = applyOps(host, initialOps, catalog)
  if (initialResult.outcomes.some(({ outcome }) => outcome !== 'applied')) {
    throw new Error('Failed to build the initial agent subgraph frame')
  }
  const initial = updateBase64(Y.encodeStateAsUpdate(host))
  const stateVector = Y.encodeStateVector(host)
  const followUpResult = applyOps(host, [followUpOp], catalog)
  if (followUpResult.outcomes[0]?.outcome !== 'applied') {
    throw new Error('Failed to build the follow-up agent subgraph frame')
  }
  const followUp = updateBase64(Y.encodeStateAsUpdate(host, stateVector))
  host.destroy()
  return { initial, followUp }
}
