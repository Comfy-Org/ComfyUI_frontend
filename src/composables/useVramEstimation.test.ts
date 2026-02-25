import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  detectModelNodes,
  estimateWorkflowVram,
  MODEL_VRAM_ESTIMATES,
  RUNTIME_OVERHEAD
} from './useVramEstimation'

const mockGetCategoryForNodeType = vi.fn<(type: string) => string | undefined>()
const mockGetAllNodeProviders = vi.fn()

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getCategoryForNodeType: mockGetCategoryForNodeType,
    getAllNodeProviders: mockGetAllNodeProviders
  })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  mapAllNodes: vi.fn(
    (
      graph: { nodes: Array<Record<string, unknown>> },
      mapFn: (node: Record<string, unknown>) => unknown
    ) => graph.nodes.map(mapFn).filter((r) => r !== undefined)
  )
}))

function makeNode(
  type: string,
  widgets: Array<{ name: string; value: unknown }> = []
) {
  return {
    type,
    isSubgraphNode: () => false,
    widgets
  }
}

function makeGraph(nodes: ReturnType<typeof makeNode>[]) {
  return { nodes } as never
}

describe('useVramEstimation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetCategoryForNodeType.mockReset()
    mockGetAllNodeProviders.mockReset()
    mockGetAllNodeProviders.mockReturnValue([])
  })

  describe('detectModelNodes', () => {
    it('returns empty array for graph with no model nodes', () => {
      mockGetCategoryForNodeType.mockReturnValue(undefined)

      const graph = makeGraph([makeNode('KSampler'), makeNode('SaveImage')])
      expect(detectModelNodes(graph)).toEqual([])
    })

    it('detects checkpoint loader nodes', () => {
      mockGetCategoryForNodeType.mockImplementation((type: string) =>
        type === 'CheckpointLoaderSimple' ? 'checkpoints' : undefined
      )

      const graph = makeGraph([
        makeNode('CheckpointLoaderSimple'),
        makeNode('KSampler')
      ])

      const result = detectModelNodes(graph)
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('checkpoints')
    })

    it('deduplicates models with same category and filename', () => {
      mockGetCategoryForNodeType.mockImplementation((type: string) =>
        type === 'CheckpointLoaderSimple' ? 'checkpoints' : undefined
      )
      mockGetAllNodeProviders.mockReturnValue([
        {
          nodeDef: { name: 'CheckpointLoaderSimple' },
          key: 'ckpt_name'
        }
      ])

      const graph = makeGraph([
        makeNode('CheckpointLoaderSimple', [
          { name: 'ckpt_name', value: 'model.safetensors' }
        ]),
        makeNode('CheckpointLoaderSimple', [
          { name: 'ckpt_name', value: 'model.safetensors' }
        ])
      ])

      expect(detectModelNodes(graph)).toHaveLength(1)
    })

    it('keeps models with same category but different filenames', () => {
      mockGetCategoryForNodeType.mockImplementation((type: string) =>
        type === 'LoraLoader' ? 'loras' : undefined
      )
      mockGetAllNodeProviders.mockReturnValue([
        { nodeDef: { name: 'LoraLoader' }, key: 'lora_name' }
      ])

      const graph = makeGraph([
        makeNode('LoraLoader', [
          { name: 'lora_name', value: 'lora_a.safetensors' }
        ]),
        makeNode('LoraLoader', [
          { name: 'lora_name', value: 'lora_b.safetensors' }
        ])
      ])

      expect(detectModelNodes(graph)).toHaveLength(2)
    })
  })

  describe('estimateWorkflowVram', () => {
    it('returns 0 for null/undefined graph', () => {
      expect(estimateWorkflowVram(null)).toBe(0)
      expect(estimateWorkflowVram(undefined)).toBe(0)
    })

    it('returns 0 for graph with no model nodes', () => {
      mockGetCategoryForNodeType.mockReturnValue(undefined)
      expect(estimateWorkflowVram(makeGraph([makeNode('KSampler')]))).toBe(0)
    })

    it('estimates checkpoint-only workflow as base + overhead', () => {
      mockGetCategoryForNodeType.mockImplementation((type: string) =>
        type === 'CheckpointLoaderSimple' ? 'checkpoints' : undefined
      )

      const result = estimateWorkflowVram(
        makeGraph([makeNode('CheckpointLoaderSimple'), makeNode('KSampler')])
      )

      expect(result).toBe(MODEL_VRAM_ESTIMATES.checkpoints + RUNTIME_OVERHEAD)
    })

    it('uses only the largest base model when multiple checkpoints exist', () => {
      mockGetCategoryForNodeType.mockImplementation((type: string) => {
        if (type === 'CheckpointLoaderSimple') return 'checkpoints'
        if (type === 'UNETLoader') return 'diffusion_models'
        return undefined
      })

      const result = estimateWorkflowVram(
        makeGraph([makeNode('CheckpointLoaderSimple'), makeNode('UNETLoader')])
      )

      const largestBase = Math.max(
        MODEL_VRAM_ESTIMATES.checkpoints,
        MODEL_VRAM_ESTIMATES.diffusion_models
      )
      expect(result).toBe(largestBase + RUNTIME_OVERHEAD)
    })

    it('sums checkpoint + lora + controlnet correctly', () => {
      mockGetCategoryForNodeType.mockImplementation((type: string) => {
        const map: Record<string, string> = {
          CheckpointLoaderSimple: 'checkpoints',
          LoraLoader: 'loras',
          ControlNetLoader: 'controlnet'
        }
        return map[type]
      })

      const result = estimateWorkflowVram(
        makeGraph([
          makeNode('CheckpointLoaderSimple'),
          makeNode('LoraLoader'),
          makeNode('ControlNetLoader')
        ])
      )

      expect(result).toBe(
        MODEL_VRAM_ESTIMATES.checkpoints +
          MODEL_VRAM_ESTIMATES.loras +
          MODEL_VRAM_ESTIMATES.controlnet +
          RUNTIME_OVERHEAD
      )
    })

    it('handles unknown model categories with default estimate', () => {
      mockGetCategoryForNodeType.mockReturnValue('some_unknown_category')

      const result = estimateWorkflowVram(
        makeGraph([makeNode('UnknownModelLoader')])
      )

      // Unknown category uses 500 MB default + runtime overhead
      expect(result).toBe(500_000_000 + RUNTIME_OVERHEAD)
    })

    it('counts multiple unique loras separately', () => {
      mockGetCategoryForNodeType.mockImplementation((type: string) =>
        type === 'LoraLoader' ? 'loras' : undefined
      )
      mockGetAllNodeProviders.mockReturnValue([
        { nodeDef: { name: 'LoraLoader' }, key: 'lora_name' }
      ])

      const result = estimateWorkflowVram(
        makeGraph([
          makeNode('LoraLoader', [
            { name: 'lora_name', value: 'lora_a.safetensors' }
          ]),
          makeNode('LoraLoader', [
            { name: 'lora_name', value: 'lora_b.safetensors' }
          ])
        ])
      )

      expect(result).toBe(MODEL_VRAM_ESTIMATES.loras * 2 + RUNTIME_OVERHEAD)
    })
  })
})
