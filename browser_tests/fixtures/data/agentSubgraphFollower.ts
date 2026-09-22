import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import subgraphWorkflow from '@e2e/assets/subgraphs/agent-subgraph-with-two-promoted-widgets.json' with { type: 'json' }
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'

export const AGENT_SUBGRAPH_WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'
export const AGENT_SUBGRAPH_HOST_ID = 11
export const AGENT_SUBGRAPH_LINK_ID = 21
export const AGENT_SUBGRAPH_INITIAL_TEXT = 'a photo of a pier'
export const AGENT_SUBGRAPH_INITIAL_SEED = 0
export const AGENT_SUBGRAPH_EDITED_SEED = 42
export const AGENT_NESTED_SUBGRAPH_ID = '52e51d98-aaac-44d3-bab1-61eae17b9869'

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
  widget: 'seed',
  value: AGENT_SUBGRAPH_EDITED_SEED,
  old: AGENT_SUBGRAPH_INITIAL_SEED,
  promoted: {
    instance_path: [AGENT_SUBGRAPH_HOST_ID],
    value_index: 1,
    host_widgets_values: [
      AGENT_SUBGRAPH_INITIAL_TEXT,
      AGENT_SUBGRAPH_INITIAL_SEED
    ]
  }
} satisfies Op

export function agentSubgraphFrames(): {
  initial: HostFrame[]
  followUp: HostFrame
} {
  const host = new HostDoc(
    AGENT_SUBGRAPH_WORKFLOW_ID,
    {
      ...subgraphWorkflow,
      definitions: {
        subgraphs: subgraphWorkflow.definitions.subgraphs.map((definition) => ({
          ...definition,
          definitions: {
            subgraphs: [{ ...definition, id: AGENT_NESTED_SUBGRAPH_ID }]
          }
        }))
      }
    },
    catalog
  )
  host.apply(initialOps)
  const initial = host.initialSync()
  const followUp = host.apply([followUpOp])
  return { initial, followUp }
}
