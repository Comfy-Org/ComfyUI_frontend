import { describe, expect, it } from 'vitest'

import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { ModelNodeProvider } from '@/stores/modelToNodeStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import { detectModels } from './workflowModelDetectionService'

function createNodeDef(name: string): ComfyNodeDefImpl {
  return { name } as ComfyNodeDefImpl
}

function createWidget(name: string, value: unknown): IBaseWidget {
  return { name, value } as unknown as IBaseWidget
}

function createNode(
  type: string,
  widgets?: IBaseWidget[],
  subgraphNodes?: LGraphNode[]
): LGraphNode {
  return {
    type,
    widgets: widgets ?? [],
    isSubgraphNode: () => !!subgraphNodes,
    subgraph: subgraphNodes
      ? ({ nodes: subgraphNodes } as unknown as Subgraph)
      : undefined
  } as unknown as LGraphNode
}

function createGraph(nodes: LGraphNode[]): LGraph {
  return { nodes } as unknown as LGraph
}

function buildModelToNodeMap() {
  return {
    checkpoints: [
      new ModelNodeProvider(
        createNodeDef('CheckpointLoaderSimple'),
        'ckpt_name'
      )
    ],
    loras: [new ModelNodeProvider(createNodeDef('LoraLoader'), 'lora_name')],
    vae: [new ModelNodeProvider(createNodeDef('VAELoader'), 'vae_name')]
  }
}

describe('detectModels', () => {
  it('returns empty array for null graph', () => {
    expect(detectModels(null, buildModelToNodeMap())).toEqual([])
  })

  it('detects a checkpoint model from a loader node', () => {
    const graph = createGraph([
      createNode('CheckpointLoaderSimple', [
        createWidget('ckpt_name', 'v1-5-pruned.safetensors')
      ])
    ])
    const result = detectModels(graph, buildModelToNodeMap())
    expect(result).toEqual([
      {
        name: 'v1-5-pruned.safetensors',
        category: 'checkpoints',
        loaderNodeType: 'CheckpointLoaderSimple'
      }
    ])
  })

  it('detects multiple model types', () => {
    const graph = createGraph([
      createNode('CheckpointLoaderSimple', [
        createWidget('ckpt_name', 'sdxl_base.safetensors')
      ]),
      createNode('LoraLoader', [
        createWidget('lora_name', 'detail_enhancer.safetensors')
      ])
    ])
    const result = detectModels(graph, buildModelToNodeMap())
    expect(result).toHaveLength(2)
    expect(result[0].category).toBe('checkpoints')
    expect(result[1].category).toBe('loras')
  })

  it('deduplicates same model referenced by multiple nodes', () => {
    const graph = createGraph([
      createNode('LoraLoader', [
        createWidget('lora_name', 'same_lora.safetensors')
      ]),
      createNode('LoraLoader', [
        createWidget('lora_name', 'same_lora.safetensors')
      ])
    ])
    const result = detectModels(graph, buildModelToNodeMap())
    expect(result).toHaveLength(1)
  })

  it('skips loader nodes with empty widget values', () => {
    const graph = createGraph([
      createNode('CheckpointLoaderSimple', [createWidget('ckpt_name', '')])
    ])
    expect(detectModels(graph, buildModelToNodeMap())).toEqual([])
  })

  it('ignores non-loader nodes', () => {
    const graph = createGraph([
      createNode('KSampler', [createWidget('seed', 12345)])
    ])
    expect(detectModels(graph, buildModelToNodeMap())).toEqual([])
  })

  it('detects models inside subgraphs', () => {
    const graph = createGraph([
      createNode(
        'Wrapper',
        [],
        [
          createNode('VAELoader', [
            createWidget('vae_name', 'vae-ft-mse.safetensors')
          ])
        ]
      )
    ])
    const result = detectModels(graph, buildModelToNodeMap())
    expect(result).toEqual([
      {
        name: 'vae-ft-mse.safetensors',
        category: 'vae',
        loaderNodeType: 'VAELoader'
      }
    ])
  })
})
