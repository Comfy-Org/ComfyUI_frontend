import { describe, expect, it, vi } from 'vitest'

import { NodeSourceType } from '@/types/nodeSource'

import {
  detectAllRequirements,
  detectCheckpointModels,
  detectCustomNodes,
  detectLoraModels,
  estimateVramRequirement
} from './useWorkflowRequirementDetection'

vi.mock('@/utils/graphTraversalUtil', () => ({
  mapAllNodes: vi.fn(
    (
      graph: { nodes: Array<{ type: string }> },
      mapFn: (node: { type: string }) => unknown
    ) => graph.nodes.map(mapFn).filter((v) => v !== undefined)
  )
}))

function makeNode(
  type: string,
  widgetValue?: string
): {
  type: string
  widgets?: Array<{ value: string }>
  isSubgraphNode: () => boolean
} {
  return {
    type,
    widgets: widgetValue ? [{ value: widgetValue }] : undefined,
    isSubgraphNode: () => false
  }
}

function makeGraph(nodes: ReturnType<typeof makeNode>[]) {
  return { nodes } as never
}

function makeNodeDefs(
  entries: Array<{
    name: string
    python_module: string
    sourceType: NodeSourceType
  }>
) {
  const result: Record<
    string,
    {
      name: string
      python_module: string
      nodeSource: { type: NodeSourceType }
    }
  > = {}
  for (const entry of entries) {
    result[entry.name] = {
      name: entry.name,
      python_module: entry.python_module,
      nodeSource: { type: entry.sourceType }
    }
  }
  return result as never
}

describe('useWorkflowRequirementDetection', () => {
  describe('detectCheckpointModels', () => {
    it('identifies checkpoint models from loader nodes', () => {
      const graph = makeGraph([
        makeNode('CheckpointLoaderSimple', 'sd_v1-5.safetensors'),
        makeNode('KSampler'),
        makeNode('CheckpointLoaderSimple', 'sdxl_base.safetensors'),
        makeNode('ImageOnlyCheckpointLoader', 'sv3d_p.safetensors')
      ])

      const result = detectCheckpointModels(graph)

      expect(result).toHaveLength(3)
      expect(result).toEqual([
        { name: 'sd_v1-5.safetensors', type: 'checkpoint', size: 0 },
        { name: 'sdxl_base.safetensors', type: 'checkpoint', size: 0 },
        { name: 'sv3d_p.safetensors', type: 'checkpoint', size: 0 }
      ])
    })

    it('deduplicates checkpoint models used in multiple nodes', () => {
      const graph = makeGraph([
        makeNode('CheckpointLoaderSimple', 'sd_v1-5.safetensors'),
        makeNode('CheckpointLoaderSimple', 'sd_v1-5.safetensors')
      ])

      const result = detectCheckpointModels(graph)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('sd_v1-5.safetensors')
    })

    it('skips nodes without widget values', () => {
      const graph = makeGraph([makeNode('CheckpointLoaderSimple')])

      const result = detectCheckpointModels(graph)

      expect(result).toHaveLength(0)
    })
  })

  describe('detectLoraModels', () => {
    it('identifies LoRA models from loader nodes', () => {
      const graph = makeGraph([
        makeNode('LoraLoader', 'add_detail.safetensors'),
        makeNode('KSampler'),
        makeNode('LoraLoaderModelOnly', 'lcm_lora.safetensors')
      ])

      const result = detectLoraModels(graph)

      expect(result).toHaveLength(2)
      expect(result).toEqual([
        { name: 'add_detail.safetensors', type: 'lora', size: 0 },
        { name: 'lcm_lora.safetensors', type: 'lora', size: 0 }
      ])
    })

    it('deduplicates LoRA models used in multiple nodes', () => {
      const graph = makeGraph([
        makeNode('LoraLoader', 'add_detail.safetensors'),
        makeNode('LoraLoaderModelOnly', 'add_detail.safetensors')
      ])

      const result = detectLoraModels(graph)

      expect(result).toHaveLength(1)
    })
  })

  describe('detectCustomNodes', () => {
    it('identifies custom nodes from the workflow graph', () => {
      const graph = makeGraph([
        makeNode('KSampler'),
        makeNode('MyCustomNode'),
        makeNode('AnotherCustom'),
        makeNode('MyCustomNode')
      ])

      const nodeDefs = makeNodeDefs([
        {
          name: 'KSampler',
          python_module: 'nodes',
          sourceType: NodeSourceType.Core
        },
        {
          name: 'MyCustomNode',
          python_module: 'custom_nodes.MyPack@1.0.nodes',
          sourceType: NodeSourceType.CustomNodes
        },
        {
          name: 'AnotherCustom',
          python_module: 'custom_nodes.OtherPack.nodes',
          sourceType: NodeSourceType.CustomNodes
        }
      ])

      const result = detectCustomNodes(graph, nodeDefs)

      expect(result).toEqual(['AnotherCustom', 'MyCustomNode'])
      expect(result).not.toContain('KSampler')
    })
  })

  describe('estimateVramRequirement', () => {
    it('estimates VRAM correctly for mixed model types', () => {
      const models = [
        { name: 'sd_v1-5.safetensors', type: 'checkpoint' as const, size: 0 },
        { name: 'add_detail.safetensors', type: 'lora' as const, size: 0 },
        { name: 'lcm_lora.safetensors', type: 'lora' as const, size: 0 }
      ]

      const result = estimateVramRequirement(models)

      const expectedBase = 512 * 1024 * 1024
      const expectedCheckpoint = 4 * 1024 * 1024 * 1024
      const expectedLora = 200 * 1024 * 1024
      expect(result).toBe(expectedBase + expectedCheckpoint + expectedLora * 2)
    })

    it('returns zero for empty model list', () => {
      expect(estimateVramRequirement([])).toBe(0)
    })
  })

  describe('detectAllRequirements', () => {
    it('handles empty workflow graph', () => {
      const result = detectAllRequirements(null, {} as never)

      expect(result).toEqual({
        checkpoints: [],
        loras: [],
        customNodes: [],
        customNodePackages: [],
        estimatedVram: 0
      })
    })

    it('handles workflow with no models or custom nodes', () => {
      const graph = makeGraph([makeNode('KSampler'), makeNode('SaveImage')])

      const nodeDefs = makeNodeDefs([
        {
          name: 'KSampler',
          python_module: 'nodes',
          sourceType: NodeSourceType.Core
        },
        {
          name: 'SaveImage',
          python_module: 'nodes',
          sourceType: NodeSourceType.Core
        }
      ])

      const result = detectAllRequirements(graph, nodeDefs)

      expect(result.checkpoints).toHaveLength(0)
      expect(result.loras).toHaveLength(0)
      expect(result.customNodes).toHaveLength(0)
      expect(result.estimatedVram).toBe(0)
    })

    it('aggregates all requirement types from a full workflow', () => {
      const graph = makeGraph([
        makeNode('CheckpointLoaderSimple', 'sd_v1-5.safetensors'),
        makeNode('LoraLoader', 'add_detail.safetensors'),
        makeNode('MyCustomNode'),
        makeNode('KSampler')
      ])

      const nodeDefs = makeNodeDefs([
        {
          name: 'KSampler',
          python_module: 'nodes',
          sourceType: NodeSourceType.Core
        },
        {
          name: 'MyCustomNode',
          python_module: 'custom_nodes.MyPack@1.0.nodes',
          sourceType: NodeSourceType.CustomNodes
        },
        {
          name: 'CheckpointLoaderSimple',
          python_module: 'nodes',
          sourceType: NodeSourceType.Core
        },
        {
          name: 'LoraLoader',
          python_module: 'nodes',
          sourceType: NodeSourceType.Core
        }
      ])

      const result = detectAllRequirements(graph, nodeDefs)

      expect(result.checkpoints).toHaveLength(1)
      expect(result.checkpoints[0].name).toBe('sd_v1-5.safetensors')
      expect(result.loras).toHaveLength(1)
      expect(result.loras[0].name).toBe('add_detail.safetensors')
      expect(result.customNodes).toEqual(['MyCustomNode'])
      expect(result.estimatedVram).toBeGreaterThan(0)
    })
  })
})
