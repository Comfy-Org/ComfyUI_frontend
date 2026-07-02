import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { resolveModelNodeFromAsset } from '@/platform/assets/utils/resolveModelNodeFromAsset'

const mockGetNodeProvider = vi.hoisted(() => vi.fn())
const mockSupportsModelTypeTags = vi.hoisted(() => ({ value: false }))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({ getNodeProvider: mockGetNodeProvider })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get supportsModelTypeTags() {
        return mockSupportsModelTypeTags.value
      }
    }
  })
}))

function createMockAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-123',
    name: 'test-model.safetensors',
    size: 1024,
    created_at: '2025-10-01T00:00:00Z',
    tags: ['models', 'checkpoints'],
    user_metadata: {
      filename: 'models/checkpoints/test-model.safetensors'
    },
    ...overrides
  }
}

function createMockNodeProvider(
  overrides: {
    nodeDef?: { name: string; display_name: string }
    key?: string
  } = {}
) {
  return {
    nodeDef: {
      name: 'CheckpointLoaderSimple',
      display_name: 'Load Checkpoint',
      ...overrides.nodeDef
    },
    key: overrides.key ?? 'ckpt_name'
  }
}

function mockProvider(
  provider: ReturnType<typeof createMockNodeProvider> | null
) {
  mockGetNodeProvider.mockReturnValue(provider)
}

describe('resolveModelNodeFromAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupportsModelTypeTags.value = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('valid assets', () => {
    it('resolves the provider for the asset category and the filename', () => {
      mockProvider(createMockNodeProvider())
      const result = resolveModelNodeFromAsset(createMockAsset())

      expect(result.success).toBe(true)
      if (result.success) {
        expect(mockGetNodeProvider).toHaveBeenCalledWith('checkpoints')
        expect(result.value.provider.nodeDef.name).toBe(
          'CheckpointLoaderSimple'
        )
        expect(result.value.filename).toBe(
          'models/checkpoints/test-model.safetensors'
        )
      }
    })

    it('strips the model_type: prefix when resolving the provider in model_type mode', () => {
      mockSupportsModelTypeTags.value = true
      mockProvider(createMockNodeProvider())
      const result = resolveModelNodeFromAsset(
        createMockAsset({ tags: ['models', 'model_type:vae'] })
      )

      expect(result.success).toBe(true)
      expect(mockGetNodeProvider).toHaveBeenCalledWith('vae')
    })

    it('skips an unresolvable incidental tag and resolves via the model_type value', () => {
      mockSupportsModelTypeTags.value = true
      mockGetNodeProvider.mockImplementation((category: string) =>
        category === 'vae' ? createMockNodeProvider() : undefined
      )
      const result = resolveModelNodeFromAsset(
        createMockAsset({ tags: ['models', 'model_type:vae', 'foo/bar'] })
      )

      expect(result.success).toBe(true)
      expect(mockGetNodeProvider).toHaveBeenCalledWith('foo/bar')
      expect(mockGetNodeProvider).toHaveBeenCalledWith('vae')
    })

    it('prefers the deepest resolvable path over a flat model_type value', () => {
      mockSupportsModelTypeTags.value = true
      mockGetNodeProvider.mockImplementation((category: string) =>
        category === 'LLM/Qwen-VL/Qwen3-0.6B'
          ? createMockNodeProvider()
          : undefined
      )
      const result = resolveModelNodeFromAsset(
        createMockAsset({
          tags: ['models', 'model_type:LLM', 'LLM/Qwen-VL/Qwen3-0.6B']
        })
      )

      expect(result.success).toBe(true)
      expect(mockGetNodeProvider).toHaveBeenCalledWith('LLM/Qwen-VL/Qwen3-0.6B')
    })

    it('falls back to metadata.filename when user_metadata.filename missing', () => {
      mockProvider(createMockNodeProvider())
      const result = resolveModelNodeFromAsset(
        createMockAsset({
          user_metadata: {},
          metadata: { filename: 'models/checkpoints/from-metadata.safetensors' }
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.filename).toBe(
          'models/checkpoints/from-metadata.safetensors'
        )
      }
    })

    it('falls back to asset.name when both filename sources missing', () => {
      mockProvider(createMockNodeProvider())
      const result = resolveModelNodeFromAsset(
        createMockAsset({ user_metadata: {}, metadata: undefined })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.filename).toBe('test-model.safetensors')
      }
    })

    it('resolves a provider with an empty key (auto-load nodes)', () => {
      mockProvider(
        createMockNodeProvider({
          nodeDef: {
            name: 'FL_ChatterboxVC',
            display_name: 'FL Chatterbox VC'
          },
          key: ''
        })
      )
      const result = resolveModelNodeFromAsset(
        createMockAsset({
          tags: ['models', 'chatterbox/chatterbox_vc'],
          user_metadata: { filename: 'chatterbox_vc_model.pt' }
        })
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.provider.key).toBe('')
        expect(result.value.filename).toBe('chatterbox_vc_model.pt')
      }
    })
  })

  describe('invalid assets', () => {
    it('fails when the asset does not match the schema', () => {
      const invalid = {
        id: 'asset-123',
        tags: ['models', 'checkpoints']
      } as unknown as AssetItem

      const result = resolveModelNodeFromAsset(invalid)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ASSET')
        expect(result.error.message).toBe('Asset schema validation failed')
        expect(result.error.assetId).toBe('asset-123')
        expect(result.error.details?.validationErrors).toBeTruthy()
      }
    })

    it.for([
      {
        case: 'missing user_metadata with no fallback',
        overrides: {
          user_metadata: undefined,
          metadata: undefined,
          name: ''
        },
        errorPattern: /Invalid filename.*expected non-empty string/
      },
      {
        case: 'empty filename with no fallback',
        overrides: {
          user_metadata: { filename: '' },
          metadata: undefined,
          name: ''
        },
        errorPattern: /Invalid filename.*expected non-empty string/
      }
    ])('fails when asset has $case', ({ overrides, errorPattern }) => {
      const result = resolveModelNodeFromAsset(createMockAsset(overrides))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ASSET')
        expect(result.error.message).toMatch(errorPattern)
        expect(result.error.assetId).toBe('asset-123')
      }
    })

    it.for([
      {
        case: 'no tags',
        overrides: { tags: undefined },
        message: 'Asset has no tags defined'
      },
      {
        case: 'only excluded tags',
        overrides: { tags: ['models', 'missing'] },
        message: 'Asset has no valid category tag'
      },
      {
        case: 'only the models tag',
        overrides: { tags: ['models'] },
        message: 'Asset has no valid category tag'
      }
    ])('fails when asset has $case', ({ overrides, message }) => {
      const result = resolveModelNodeFromAsset(createMockAsset(overrides))
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ASSET')
        expect(result.error.message).toBe(message)
      }
    })

    it('fails when no provider is registered for the category', () => {
      mockProvider(null)
      const result = resolveModelNodeFromAsset(createMockAsset())
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NO_PROVIDER')
        expect(result.error.message).toContain('checkpoints')
        expect(result.error.details?.candidates).toEqual(['checkpoints'])
      }
    })
  })
})
