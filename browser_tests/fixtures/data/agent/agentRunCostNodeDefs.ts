import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

export const PRICED_API_NODE = 'TestPricedApiNode'
export const PER_TOKEN_API_NODE = 'TestPerTokenApiNode'
export const DESCRIBED_API_NODE = 'TestDescribedApiNode'
export const OSS_NODE = 'TestOssNode'

const PRICED_API_NODE_USD = 0.05

function apiNodeDef(name: string, expr: string | null): ComfyNodeDef {
  return {
    name,
    display_name: name,
    description: '',
    category: 'api node/test',
    python_module: 'comfy_api_nodes.nodes_test',
    output_node: false,
    api_node: true,
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE'],
    input: { required: {} },
    input_order: { required: [] },
    ...(expr && {
      price_badge: {
        engine: 'jsonata' as const,
        expr,
        depends_on: { widgets: [], inputs: [], input_groups: [] }
      }
    })
  }
}

/** Api nodes covering each published price shape, plus one OSS node. */
export const runCostNodeDefs: Record<string, ComfyNodeDef> = {
  [PRICED_API_NODE]: apiNodeDef(
    PRICED_API_NODE,
    `{"type":"usd","usd":${PRICED_API_NODE_USD}}`
  ),
  [PER_TOKEN_API_NODE]: apiNodeDef(
    PER_TOKEN_API_NODE,
    '{"type":"usd","usd":0.002,"format":{"suffix":" per 1K tokens"}}'
  ),
  [DESCRIBED_API_NODE]: apiNodeDef(
    DESCRIBED_API_NODE,
    '{"type":"text","text":"Priced per token"}'
  ),
  [OSS_NODE]: {
    ...apiNodeDef(OSS_NODE, null),
    api_node: false,
    category: 'test',
    python_module: 'nodes'
  }
}

/** The run approval card's floor line for a given credits figure. */
export const atLeastCredits = (credits: string) =>
  enMessages.agent.runApproval.estimateAtLeast.replace('{credits}', credits)
