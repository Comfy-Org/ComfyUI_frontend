import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import {
  ModelNodeProvider,
  useModelToNodeStore
} from '@/stores/modelToNodeStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

const EXPECTED_DEFAULT_TYPES = [
  'checkpoints',
  'loras',
  'vae',
  'controlnet',
  'unet',
  'upscale_models',
  'style_models',
  'gligen'
] as const

type NodeDefStoreType = typeof import('@/stores/nodeDefStore')

// Mock nodeDefStore dependency - modelToNodeStore relies on this for registration
// Most tests expect this to be populated; tests that need empty state can override
vi.mock('@/stores/nodeDefStore', async (importOriginal) => {
  const original = await importOriginal<NodeDefStoreType>()
  const { ComfyNodeDefImpl } = original

  // Create minimal but valid ComfyNodeDefImpl for testing
  function createMockNodeDef(name: string): ComfyNodeDefImpl {
    const def: ComfyNodeDefV1 = {
      name,
      display_name: name,
      category: 'test',
      python_module: 'nodes',
      description: '',
      input: { required: {}, optional: {} },
      output: [],
      output_name: [],
      output_is_list: [],
      output_node: false
    }
    return new ComfyNodeDefImpl(def)
  }

  const MOCK_NODE_NAMES = [
    'CheckpointLoaderSimple',
    'ImageOnlyCheckpointLoader',
    'LoraLoader',
    'LoraLoaderModelOnly',
    'VAELoader',
    'ControlNetLoader',
    'UNETLoader',
    'UpscaleModelLoader',
    'StyleModelLoader',
    'GLIGENLoader'
  ] as const

  const mockNodeDefsByName = Object.fromEntries(
    MOCK_NODE_NAMES.map((name) => [name, createMockNodeDef(name)])
  )

  return {
    ...original,
    useNodeDefStore: vi.fn(() => ({
      nodeDefsByName: mockNodeDefsByName
    }))
  }
})

describe('useModelToNodeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('modelToNodeMap', () => {
    it('should initialize as empty', () => {
      const modelToNodeStore = useModelToNodeStore()
      expect(Object.keys(modelToNodeStore.modelToNodeMap)).toHaveLength(0)
    })

    it('should populate after registration', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()
      expect(Object.keys(modelToNodeStore.modelToNodeMap)).toEqual(
        expect.arrayContaining(['checkpoints', 'unet'])
      )
    })
  })

  describe('getNodeProvider', () => {
    it('should return provider for registered model type', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      const provider = modelToNodeStore.getNodeProvider('checkpoints')
      expect(provider).toBeDefined()
      // After asserting provider is defined, we can safely access its properties
      expect(provider?.nodeDef?.name).toBe('CheckpointLoaderSimple')
      expect(provider?.key).toBe('ckpt_name')
    })

    it('should return undefined for unregistered model type', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()
      expect(modelToNodeStore.getNodeProvider('nonexistent')).toBeUndefined()
    })

    it('should return first registered provider when multiple providers exist for same model type', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      const provider = modelToNodeStore.getNodeProvider('checkpoints')
      // Using optional chaining for safety since getNodeProvider() can return undefined
      expect(provider?.nodeDef?.name).toBe('CheckpointLoaderSimple')
    })

    it('should trigger lazy registration when called before registerDefaults', () => {
      const modelToNodeStore = useModelToNodeStore()

      const provider = modelToNodeStore.getNodeProvider('checkpoints')
      expect(provider).toBeDefined()
    })
  })

  describe('getAllNodeProviders', () => {
    it('should return all providers for model type with multiple nodes', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      const checkpointProviders =
        modelToNodeStore.getAllNodeProviders('checkpoints')
      expect(checkpointProviders).toHaveLength(2)
      expect(checkpointProviders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nodeDef: expect.objectContaining({ name: 'CheckpointLoaderSimple' })
          }),
          expect.objectContaining({
            nodeDef: expect.objectContaining({
              name: 'ImageOnlyCheckpointLoader'
            })
          })
        ])
      )

      const loraProviders = modelToNodeStore.getAllNodeProviders('loras')
      expect(loraProviders).toHaveLength(2)
    })

    it('should return single provider for model type with one node', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      const unetProviders = modelToNodeStore.getAllNodeProviders('unet')
      expect(unetProviders).toHaveLength(1)
      expect(unetProviders[0].nodeDef.name).toBe('UNETLoader')
    })

    it('should return empty array for unregistered model type', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()
      expect(modelToNodeStore.getAllNodeProviders('nonexistent')).toEqual([])
    })

    it('should trigger lazy registration when called before registerDefaults', () => {
      const modelToNodeStore = useModelToNodeStore()

      const providers = modelToNodeStore.getAllNodeProviders('checkpoints')
      expect(providers.length).toBeGreaterThan(0)
    })
  })

  describe('registerNodeProvider', () => {
    it('should register provider directly', () => {
      const modelToNodeStore = useModelToNodeStore()
      const nodeDefStore = useNodeDefStore()
      const customProvider = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['UNETLoader'],
        'custom_key'
      )

      modelToNodeStore.registerNodeProvider('custom_type', customProvider)

      const retrieved = modelToNodeStore.getNodeProvider('custom_type')
      expect(retrieved).toStrictEqual(customProvider)
      // Optional chaining for consistency with getNodeProvider() return type
      expect(retrieved?.key).toBe('custom_key')
    })

    it('should handle multiple providers for same model type and return first as primary', () => {
      const modelToNodeStore = useModelToNodeStore()
      const nodeDefStore = useNodeDefStore()
      const provider1 = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['UNETLoader'],
        'key1'
      )
      const provider2 = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['VAELoader'],
        'key2'
      )

      modelToNodeStore.registerNodeProvider('multi_type', provider1)
      modelToNodeStore.registerNodeProvider('multi_type', provider2)

      const allProviders = modelToNodeStore.getAllNodeProviders('multi_type')
      expect(allProviders).toHaveLength(2)
      expect(modelToNodeStore.getNodeProvider('multi_type')).toStrictEqual(
        provider1
      )
    })

    it('should initialize new model type when first provider is registered', () => {
      const modelToNodeStore = useModelToNodeStore()
      const nodeDefStore = useNodeDefStore()
      expect(modelToNodeStore.modelToNodeMap['new_type']).toBeUndefined()

      const provider = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['UNETLoader'],
        'test_key'
      )
      modelToNodeStore.registerNodeProvider('new_type', provider)

      expect(modelToNodeStore.modelToNodeMap['new_type']).toBeDefined()
      expect(modelToNodeStore.modelToNodeMap['new_type']).toHaveLength(1)
    })
  })

  describe('quickRegister', () => {
    it('should connect node class to model type with parameter mapping', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.quickRegister('test_type', 'UNETLoader', 'test_param')

      const provider = modelToNodeStore.getNodeProvider('test_type')
      expect(provider).toBeDefined()
      // After asserting provider is defined, we can safely access its properties
      expect(provider!.nodeDef.name).toBe('UNETLoader')
      expect(provider!.key).toBe('test_param')
    })

    it('should handle registration of non-existent node classes gracefully', () => {
      const modelToNodeStore = useModelToNodeStore()
      expect(() => {
        modelToNodeStore.quickRegister(
          'test_type',
          'NonExistentLoader',
          'test_param'
        )
      }).not.toThrow()

      const provider = modelToNodeStore.getNodeProvider('test_type')
      // Optional chaining needed since getNodeProvider() can return undefined
      expect(provider?.nodeDef).toBeUndefined()
    })

    it('should allow multiple node classes for same model type', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.quickRegister('multi_type', 'UNETLoader', 'param1')
      modelToNodeStore.quickRegister('multi_type', 'VAELoader', 'param2')

      const providers = modelToNodeStore.getAllNodeProviders('multi_type')
      expect(providers).toHaveLength(2)
    })
  })

  describe('registerDefaults integration', () => {
    it('should register all expected model types based on mock data', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      for (const modelType of EXPECTED_DEFAULT_TYPES) {
        expect.soft(modelToNodeStore.getNodeProvider(modelType)).toBeDefined()
      }
    })

    it('should be idempotent', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()
      const firstCheckpointCount =
        modelToNodeStore.getAllNodeProviders('checkpoints').length

      modelToNodeStore.registerDefaults() // Call again
      const secondCheckpointCount =
        modelToNodeStore.getAllNodeProviders('checkpoints').length

      expect(secondCheckpointCount).toBe(firstCheckpointCount)
    })

    it('should not register when nodeDefStore is empty', () => {
      vi.mocked(useNodeDefStore, { partial: true }).mockReturnValue({
        nodeDefsByName: {}
      })
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()
      expect(modelToNodeStore.getNodeProvider('checkpoints')).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty string model type', () => {
      const modelToNodeStore = useModelToNodeStore()
      expect(modelToNodeStore.getNodeProvider('')).toBeUndefined()
      expect(modelToNodeStore.getAllNodeProviders('')).toEqual([])
    })
  })
})
