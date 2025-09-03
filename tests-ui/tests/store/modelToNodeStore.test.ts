import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  ModelNodeProvider,
  useModelToNodeStore
} from '@/stores/modelToNodeStore'
import { type ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

describe('useModelToNodeStore', () => {
  let store: ReturnType<typeof useModelToNodeStore>
  let nodeDefStore: ReturnType<typeof useNodeDefStore>

  // Create minimal mock for testing - only includes 'name' field since that's
  // the only property ModelNodeProvider constructor uses and tests verify
  const createMockNodeDef = (name: string): ComfyNodeDefImpl => {
    return { name } as ComfyNodeDefImpl
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useModelToNodeStore()
    nodeDefStore = useNodeDefStore()

    const mockNodeNames = [
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
    ]

    const mockNodeDefs: Record<string, ComfyNodeDefImpl> = Object.fromEntries(
      mockNodeNames.map((name) => [name, createMockNodeDef(name)])
    )

    nodeDefStore.nodeDefsByName = mockNodeDefs
  })

  describe('modelToNodeMap', () => {
    it('should initialize as empty', () => {
      expect(Object.keys(store.modelToNodeMap)).toHaveLength(0)
    })

    it('should populate after registration', () => {
      store.registerDefaults()
      expect(Object.keys(store.modelToNodeMap)).toContain('checkpoints')
      expect(Object.keys(store.modelToNodeMap)).toContain('unet')
    })
  })

  describe('getNodeProvider', () => {
    it('should return provider for registered model type', () => {
      store.registerDefaults()

      const provider = store.getNodeProvider('checkpoints')
      expect(provider).toBeDefined()
      // Optional chaining used because getNodeProvider() can return undefined for unregistered types
      expect(provider?.nodeDef.name).toBe('CheckpointLoaderSimple')
      expect(provider?.key).toBe('ckpt_name')
    })

    it('should return undefined for unregistered model type', () => {
      store.registerDefaults()
      expect(store.getNodeProvider('nonexistent')).toBeUndefined()
    })

    it('should return first registered provider when multiple providers exist for same model type', () => {
      store.registerDefaults()

      const provider = store.getNodeProvider('checkpoints')
      // Using optional chaining for safety since getNodeProvider() can return undefined
      expect(provider?.nodeDef.name).toBe('CheckpointLoaderSimple')
    })

    it('should trigger lazy registration when called before registerDefaults', () => {
      const provider = store.getNodeProvider('checkpoints')
      expect(provider).toBeDefined()
    })
  })

  describe('getAllNodeProviders', () => {
    it('should return all providers for model type with multiple nodes', () => {
      store.registerDefaults()

      const checkpointProviders = store.getAllNodeProviders('checkpoints')
      expect(checkpointProviders).toHaveLength(2)
      expect(checkpointProviders.map((p) => p.nodeDef.name)).toContain(
        'CheckpointLoaderSimple'
      )
      expect(checkpointProviders.map((p) => p.nodeDef.name)).toContain(
        'ImageOnlyCheckpointLoader'
      )

      const loraProviders = store.getAllNodeProviders('loras')
      expect(loraProviders).toHaveLength(2)
    })

    it('should return single provider for model type with one node', () => {
      store.registerDefaults()

      const unetProviders = store.getAllNodeProviders('unet')
      expect(unetProviders).toHaveLength(1)
      expect(unetProviders[0].nodeDef.name).toBe('UNETLoader')
    })

    it('should return empty array for unregistered model type', () => {
      store.registerDefaults()
      expect(store.getAllNodeProviders('nonexistent')).toEqual([])
    })

    it('should trigger lazy registration when called before registerDefaults', () => {
      const providers = store.getAllNodeProviders('checkpoints')
      expect(providers.length).toBeGreaterThan(0)
    })
  })

  describe('registerNodeProvider', () => {
    it('should register provider directly', () => {
      const customProvider = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['UNETLoader'],
        'custom_key'
      )

      store.registerNodeProvider('custom_type', customProvider)

      const retrieved = store.getNodeProvider('custom_type')
      expect(retrieved).toStrictEqual(customProvider)
      // Optional chaining for consistency with getNodeProvider() return type
      expect(retrieved?.key).toBe('custom_key')
    })

    it('should handle multiple providers for same model type and return first as primary', () => {
      const provider1 = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['UNETLoader'],
        'key1'
      )
      const provider2 = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['VAELoader'],
        'key2'
      )

      store.registerNodeProvider('multi_type', provider1)
      store.registerNodeProvider('multi_type', provider2)

      const allProviders = store.getAllNodeProviders('multi_type')
      expect(allProviders).toHaveLength(2)
      expect(store.getNodeProvider('multi_type')).toStrictEqual(provider1)
    })

    it('should initialize new model type when first provider is registered', () => {
      expect(store.modelToNodeMap['new_type']).toBeUndefined()

      const provider = new ModelNodeProvider(
        nodeDefStore.nodeDefsByName['UNETLoader'],
        'test_key'
      )
      store.registerNodeProvider('new_type', provider)

      expect(store.modelToNodeMap['new_type']).toBeDefined()
      expect(store.modelToNodeMap['new_type']).toHaveLength(1)
    })
  })

  describe('quickRegister', () => {
    it('should connect node class to model type with parameter mapping', () => {
      store.quickRegister('test_type', 'UNETLoader', 'test_param')

      const provider = store.getNodeProvider('test_type')
      expect(provider).toBeDefined()
      // Using optional chaining since getNodeProvider() can return undefined
      expect(provider?.nodeDef.name).toBe('UNETLoader')
      expect(provider?.key).toBe('test_param')
    })

    it('should handle registration of non-existent node classes gracefully', () => {
      expect(() => {
        store.quickRegister('test_type', 'NonExistentLoader', 'test_param')
      }).not.toThrow()

      const provider = store.getNodeProvider('test_type')
      // Optional chaining needed since getNodeProvider() can return undefined
      expect(provider?.nodeDef).toBeUndefined()
    })

    it('should allow multiple node classes for same model type', () => {
      store.quickRegister('multi_type', 'UNETLoader', 'param1')
      store.quickRegister('multi_type', 'VAELoader', 'param2')

      const providers = store.getAllNodeProviders('multi_type')
      expect(providers).toHaveLength(2)
    })
  })

  describe('registerDefaults integration', () => {
    it('should register all expected model types based on mock data', () => {
      store.registerDefaults()

      const expectedTypes = [
        'checkpoints',
        'loras',
        'vae',
        'controlnet',
        'unet',
        'upscale_models',
        'style_models',
        'gligen'
      ]

      expectedTypes.forEach((modelType) => {
        expect(store.getNodeProvider(modelType)).toBeDefined()
      })
    })

    it('should be idempotent', () => {
      store.registerDefaults()
      const firstCheckpointCount =
        store.getAllNodeProviders('checkpoints').length

      store.registerDefaults() // Call again
      const secondCheckpointCount =
        store.getAllNodeProviders('checkpoints').length

      expect(secondCheckpointCount).toBe(firstCheckpointCount)
    })

    it('should not register when nodeDefStore is empty', () => {
      nodeDefStore.nodeDefsByName = {}
      store.registerDefaults()
      expect(store.getNodeProvider('checkpoints')).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty string model type', () => {
      expect(store.getNodeProvider('')).toBeUndefined()
      expect(store.getAllNodeProviders('')).toEqual([])
    })
  })
})
