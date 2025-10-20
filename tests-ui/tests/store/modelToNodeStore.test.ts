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
  'diffusion_models',
  'upscale_models',
  'style_models',
  'gligen',
  'clip_vision',
  'text_encoders',
  'audio_encoders',
  'model_patches',
  'animatediff_models',
  'animatediff_motion_lora'
] as const

type NodeDefStoreType = ReturnType<typeof useNodeDefStore>

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
  'GLIGENLoader',
  'CLIPVisionLoader',
  'CLIPLoader',
  'AudioEncoderLoader',
  'ModelPatchLoader',
  'ADE_LoadAnimateDiffModel',
  'ADE_AnimateDiffLoRALoader'
] as const

const mockNodeDefsByName = Object.fromEntries(
  MOCK_NODE_NAMES.map((name) => [name, createMockNodeDef(name)])
)

// Mock nodeDefStore dependency - modelToNodeStore relies on this for registration
// Most tests expect this to be populated; tests that need empty state can override
vi.mock('@/stores/nodeDefStore', async (importOriginal) => {
  const original = await importOriginal<NodeDefStoreType>()

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
    vi.clearAllMocks()
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
        expect.arrayContaining(['checkpoints', 'diffusion_models'])
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

      const diffusionModelProviders =
        modelToNodeStore.getAllNodeProviders('diffusion_models')
      expect(diffusionModelProviders).toHaveLength(1)
      expect(diffusionModelProviders[0].nodeDef.name).toBe('UNETLoader')
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
    it('should not register provider when nodeDef is undefined', () => {
      const modelToNodeStore = useModelToNodeStore()
      const providerWithoutNodeDef = new ModelNodeProvider(
        undefined as any,
        'custom_key'
      )

      modelToNodeStore.registerNodeProvider(
        'custom_type',
        providerWithoutNodeDef
      )

      const retrieved = modelToNodeStore.getNodeProvider('custom_type')
      expect(retrieved).toBeUndefined()
    })

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
      expect(provider?.nodeDef).toBeUndefined()

      expect(() => modelToNodeStore.getRegisteredNodeTypes()).not.toThrow()
      expect(() =>
        modelToNodeStore.getCategoryForNodeType('NonExistentLoader')
      ).not.toThrow()

      // Non-existent nodes are filtered out from registered types
      const types = modelToNodeStore.getRegisteredNodeTypes()
      expect(types.has('NonExistentLoader')).toBe(false)

      expect(
        modelToNodeStore.getCategoryForNodeType('NonExistentLoader')
      ).toBeUndefined()
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
      // Create fresh Pinia for this test to avoid state persistence
      setActivePinia(createPinia())

      vi.mocked(useNodeDefStore, { partial: true }).mockReturnValue({
        nodeDefsByName: {}
      })
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()
      expect(modelToNodeStore.getNodeProvider('checkpoints')).toBeUndefined()

      // Restore original mock for subsequent tests
      vi.mocked(useNodeDefStore, { partial: true }).mockReturnValue({
        nodeDefsByName: mockNodeDefsByName
      })
    })
  })

  describe('getRegisteredNodeTypes', () => {
    it('should return a Set instance', () => {
      const modelToNodeStore = useModelToNodeStore()
      const result = modelToNodeStore.getRegisteredNodeTypes()
      expect(result).toBeInstanceOf(Set)
    })

    it('should return empty set when nodeDefStore is empty', () => {
      // Create fresh Pinia for this test to avoid state persistence
      setActivePinia(createPinia())

      vi.mocked(useNodeDefStore, { partial: true }).mockReturnValue({
        nodeDefsByName: {}
      })
      const modelToNodeStore = useModelToNodeStore()

      const result = modelToNodeStore.getRegisteredNodeTypes()
      expect(result.size).toBe(0)

      // Restore original mock for subsequent tests
      vi.mocked(useNodeDefStore, { partial: true }).mockReturnValue({
        nodeDefsByName: mockNodeDefsByName
      })
    })

    it('should contain node types for efficient Set.has() lookups', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      const result = modelToNodeStore.getRegisteredNodeTypes()

      // Test Set.has() functionality which assetService depends on
      expect(result.has('CheckpointLoaderSimple')).toBe(true)
      expect(result.has('LoraLoader')).toBe(true)
      expect(result.has('NonExistentNode')).toBe(false)
    })
  })

  describe('getCategoryForNodeType', () => {
    it('should return category for known node type', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      expect(
        modelToNodeStore.getCategoryForNodeType('CheckpointLoaderSimple')
      ).toBe('checkpoints')
      expect(modelToNodeStore.getCategoryForNodeType('LoraLoader')).toBe(
        'loras'
      )
      expect(modelToNodeStore.getCategoryForNodeType('VAELoader')).toBe('vae')
    })

    it('should return undefined for unknown node type', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      expect(
        modelToNodeStore.getCategoryForNodeType('NonExistentNode')
      ).toBeUndefined()
      expect(modelToNodeStore.getCategoryForNodeType('')).toBeUndefined()
    })

    it('should return first category when node type exists in multiple categories', () => {
      const modelToNodeStore = useModelToNodeStore()

      // Test with a node that exists in the defaults but add our own first
      // Since defaults register 'StyleModelLoader' in 'style_models',
      // we verify our custom registrations come after defaults in Object.entries iteration
      const result = modelToNodeStore.getCategoryForNodeType('StyleModelLoader')
      expect(result).toBe('style_models') // This proves the method works correctly

      // Now test that custom registrations after defaults also work
      modelToNodeStore.quickRegister(
        'unicorn_styles',
        'StyleModelLoader',
        'param1'
      )
      const result2 =
        modelToNodeStore.getCategoryForNodeType('StyleModelLoader')
      // Should still be style_models since it was registered first by defaults
      expect(result2).toBe('style_models')
    })

    it('should trigger lazy registration when called before registerDefaults', () => {
      const modelToNodeStore = useModelToNodeStore()

      const result = modelToNodeStore.getCategoryForNodeType(
        'CheckpointLoaderSimple'
      )
      expect(result).toBe('checkpoints')
    })

    it('should be performant for repeated lookups', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      // Measure performance without assuming implementation
      const start = performance.now()
      for (let i = 0; i < 1000; i++) {
        modelToNodeStore.getCategoryForNodeType('CheckpointLoaderSimple')
      }
      const end = performance.now()

      // Should be fast enough for UI responsiveness
      expect(end - start).toBeLessThan(10)
    })

    it('should handle invalid input types gracefully', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      // These should not throw but return undefined
      expect(
        modelToNodeStore.getCategoryForNodeType(null as any)
      ).toBeUndefined()
      expect(
        modelToNodeStore.getCategoryForNodeType(undefined as any)
      ).toBeUndefined()
      expect(
        modelToNodeStore.getCategoryForNodeType(123 as any)
      ).toBeUndefined()
    })

    it('should be case-sensitive for node type matching', () => {
      const modelToNodeStore = useModelToNodeStore()
      modelToNodeStore.registerDefaults()

      expect(
        modelToNodeStore.getCategoryForNodeType('checkpointloadersimple')
      ).toBeUndefined()
      expect(
        modelToNodeStore.getCategoryForNodeType('CHECKPOINTLOADERSIMPLE')
      ).toBeUndefined()
      expect(
        modelToNodeStore.getCategoryForNodeType('CheckpointLoaderSimple')
      ).toBe('checkpoints')
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
