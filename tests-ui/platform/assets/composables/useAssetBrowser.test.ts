import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'assetBrowser.allModels': 'All Models',
      'assetBrowser.assets': 'Assets',
      'assetBrowser.unknown': 'unknown'
    }
    return translations[key] || key
  },
  d: (date: Date) => date.toLocaleDateString()
}))

describe('useAssetBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // Test fixtures - minimal data focused on functionality being tested
  const createApiAsset = (overrides: Partial<AssetItem> = {}): AssetItem => ({
    id: 'test-id',
    name: 'test-asset.safetensors',
    asset_hash: 'blake3:abc123',
    size: 1024,
    mime_type: 'application/octet-stream',
    tags: ['models', 'checkpoints'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z',
    ...overrides
  })

  describe('Category Filtering', () => {
    it('exposes category-filtered assets for filter options', () => {
      const checkpointAsset = createApiAsset({
        id: 'checkpoint-1',
        name: 'model.safetensors',
        tags: ['models', 'checkpoints']
      })
      const loraAsset = createApiAsset({
        id: 'lora-1',
        name: 'lora.pt',
        tags: ['models', 'loras']
      })

      const { selectedCategory, categoryFilteredAssets } = useAssetBrowser(
        ref([checkpointAsset, loraAsset])
      )

      // Initially should show all assets
      expect(categoryFilteredAssets.value).toHaveLength(2)

      // When category selected, should only show that category
      selectedCategory.value = 'checkpoints'
      expect(categoryFilteredAssets.value).toHaveLength(1)
      expect(categoryFilteredAssets.value[0].id).toBe('checkpoint-1')

      selectedCategory.value = 'loras'
      expect(categoryFilteredAssets.value).toHaveLength(1)
      expect(categoryFilteredAssets.value[0].id).toBe('lora-1')
    })
  })

  describe('Asset Transformation', () => {
    it('transforms API asset to include display properties', () => {
      const apiAsset = createApiAsset({
        user_metadata: { description: 'Test model' }
      })

      const { filteredAssets } = useAssetBrowser(ref([apiAsset]))
      const result = filteredAssets.value[0] // Get the transformed asset from filteredAssets

      // Preserves API properties
      expect(result.id).toBe(apiAsset.id)
      expect(result.name).toBe(apiAsset.name)

      // Adds display properties
      expect(result.description).toBe('Test model')
      expect(result.badges).toContainEqual({
        label: 'checkpoints',
        type: 'type'
      })
    })

    it('creates fallback description from tags when metadata missing', () => {
      const apiAsset = createApiAsset({
        tags: ['models', 'loras'],
        user_metadata: undefined
      })

      const { filteredAssets } = useAssetBrowser(ref([apiAsset]))
      const result = filteredAssets.value[0]

      expect(result.description).toBe('loras model')
    })
  })

  describe('Tag-Based Filtering', () => {
    it('filters assets by category tag', async () => {
      const assets = [
        createApiAsset({ id: '1', tags: ['models', 'checkpoints'] }),
        createApiAsset({ id: '2', tags: ['models', 'loras'] }),
        createApiAsset({ id: '3', tags: ['models', 'checkpoints'] })
      ]

      const { selectedCategory, filteredAssets } = useAssetBrowser(ref(assets))

      selectedCategory.value = 'checkpoints'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(2)
      expect(
        filteredAssets.value.every((asset) =>
          asset.tags.includes('checkpoints')
        )
      ).toBe(true)
    })

    it('returns all assets when category is "all"', async () => {
      const assets = [
        createApiAsset({ id: '1', tags: ['models', 'checkpoints'] }),
        createApiAsset({ id: '2', tags: ['models', 'loras'] })
      ]

      const { selectedCategory, filteredAssets } = useAssetBrowser(ref(assets))

      selectedCategory.value = 'all'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(2)
    })
  })

  describe('Fuzzy Search Functionality', () => {
    it('searches across asset name with exact match', async () => {
      const assets = [
        createApiAsset({ name: 'realistic_vision.safetensors' }),
        createApiAsset({ name: 'anime_style.ckpt' }),
        createApiAsset({ name: 'photorealistic_v2.safetensors' })
      ]

      const { searchQuery, filteredAssets } = useAssetBrowser(ref(assets))

      searchQuery.value = 'realistic'
      await nextTick()

      expect(filteredAssets.value.length).toBeGreaterThanOrEqual(1)
      expect(
        filteredAssets.value.some((asset) =>
          asset.name.toLowerCase().includes('realistic')
        )
      ).toBe(true)
    })

    it('searches across asset tags', async () => {
      const assets = [
        createApiAsset({
          name: 'model1.safetensors',
          tags: ['models', 'checkpoints']
        }),
        createApiAsset({
          name: 'model2.safetensors',
          tags: ['models', 'loras']
        })
      ]

      const { searchQuery, filteredAssets } = useAssetBrowser(ref(assets))

      searchQuery.value = 'checkpoints'
      await nextTick()

      expect(filteredAssets.value.length).toBeGreaterThanOrEqual(1)
      expect(filteredAssets.value[0].tags).toContain('checkpoints')
    })

    it('supports fuzzy matching with typos', async () => {
      const assets = [
        createApiAsset({ name: 'checkpoint_model.safetensors' }),
        createApiAsset({ name: 'lora_model.safetensors' })
      ]

      const { searchQuery, filteredAssets } = useAssetBrowser(ref(assets))

      // Intentional typo - fuzzy search should still find it
      searchQuery.value = 'chckpoint'
      await nextTick()

      expect(filteredAssets.value.length).toBeGreaterThanOrEqual(1)
      expect(filteredAssets.value[0].name).toContain('checkpoint')
    })

    it('handles empty search by returning all assets', async () => {
      const assets = [
        createApiAsset({ name: 'test1.safetensors' }),
        createApiAsset({ name: 'test2.safetensors' })
      ]

      const { searchQuery, filteredAssets } = useAssetBrowser(ref(assets))

      searchQuery.value = ''
      await nextTick()

      expect(filteredAssets.value).toHaveLength(2)
    })

    it('handles no search results', async () => {
      const assets = [createApiAsset({ name: 'test.safetensors' })]

      const { searchQuery, filteredAssets } = useAssetBrowser(ref(assets))

      searchQuery.value = 'completelydifferentstring123'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(0)
    })

    it('performs case-insensitive search', async () => {
      const assets = [
        createApiAsset({ name: 'RealisticVision.safetensors' }),
        createApiAsset({ name: 'anime_style.ckpt' })
      ]

      const { searchQuery, filteredAssets } = useAssetBrowser(ref(assets))

      searchQuery.value = 'REALISTIC'
      await nextTick()

      expect(filteredAssets.value.length).toBeGreaterThanOrEqual(1)
      expect(filteredAssets.value[0].name).toContain('Realistic')
    })

    it('combines fuzzy search with format filter', async () => {
      const assets = [
        createApiAsset({ name: 'my_checkpoint_model.safetensors' }),
        createApiAsset({ name: 'my_checkpoint_model.ckpt' }),
        createApiAsset({ name: 'different_lora.safetensors' })
      ]

      const { searchQuery, updateFilters, filteredAssets } = useAssetBrowser(
        ref(assets)
      )

      searchQuery.value = 'checkpoint'
      updateFilters({
        sortBy: 'name-asc',
        fileFormats: ['safetensors'],
        baseModels: []
      })
      await nextTick()

      expect(filteredAssets.value.length).toBeGreaterThanOrEqual(1)
      expect(
        filteredAssets.value.every((asset) =>
          asset.name.endsWith('.safetensors')
        )
      ).toBe(true)
      expect(
        filteredAssets.value.some((asset) => asset.name.includes('checkpoint'))
      ).toBe(true)
    })

    it('combines fuzzy search with base model filter', async () => {
      const assets = [
        createApiAsset({
          name: 'realistic_sd15.safetensors',
          user_metadata: { base_model: 'SD1.5' }
        }),
        createApiAsset({
          name: 'realistic_sdxl.safetensors',
          user_metadata: { base_model: 'SDXL' }
        })
      ]

      const { searchQuery, updateFilters, filteredAssets } = useAssetBrowser(
        ref(assets)
      )

      searchQuery.value = 'realistic'
      updateFilters({
        sortBy: 'name-asc',
        fileFormats: [],
        baseModels: ['SDXL']
      })
      await nextTick()

      expect(filteredAssets.value).toHaveLength(1)
      expect(filteredAssets.value[0].name).toBe('realistic_sdxl.safetensors')
    })
  })

  describe('Combined Search and Filtering', () => {
    it('applies both search and category filter', async () => {
      const assets = [
        createApiAsset({
          name: 'realistic_checkpoint.safetensors',
          tags: ['models', 'checkpoints']
        }),
        createApiAsset({
          name: 'realistic_lora.safetensors',
          tags: ['models', 'loras']
        }),
        createApiAsset({
          name: 'anime_checkpoint.safetensors',
          tags: ['models', 'checkpoints']
        })
      ]

      const { searchQuery, selectedCategory, filteredAssets } = useAssetBrowser(
        ref(assets)
      )

      searchQuery.value = 'realistic'
      selectedCategory.value = 'checkpoints'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(1)
      expect(filteredAssets.value[0].name).toBe(
        'realistic_checkpoint.safetensors'
      )
    })
  })

  describe('Sorting', () => {
    it('sorts assets by name', async () => {
      const assets = [
        createApiAsset({ name: 'zebra.safetensors' }),
        createApiAsset({ name: 'alpha.safetensors' }),
        createApiAsset({ name: 'beta.safetensors' })
      ]

      const { updateFilters, filteredAssets } = useAssetBrowser(ref(assets))

      updateFilters({ sortBy: 'name', fileFormats: [], baseModels: [] })
      await nextTick()

      const names = filteredAssets.value.map((asset) => asset.name)
      expect(names).toEqual([
        'alpha.safetensors',
        'beta.safetensors',
        'zebra.safetensors'
      ])
    })

    it('sorts assets by creation date', async () => {
      const assets = [
        createApiAsset({ created_at: '2024-03-01T00:00:00Z' }),
        createApiAsset({ created_at: '2024-01-01T00:00:00Z' }),
        createApiAsset({ created_at: '2024-02-01T00:00:00Z' })
      ]

      const { updateFilters, filteredAssets } = useAssetBrowser(ref(assets))

      updateFilters({ sortBy: 'recent', fileFormats: [], baseModels: [] })
      await nextTick()

      const dates = filteredAssets.value.map((asset) => asset.created_at)
      expect(dates).toEqual([
        '2024-03-01T00:00:00Z',
        '2024-02-01T00:00:00Z',
        '2024-01-01T00:00:00Z'
      ])
    })
  })

  describe('Dynamic Category Extraction', () => {
    it('extracts categories from asset tags', () => {
      const assets = [
        createApiAsset({ tags: ['models', 'checkpoints'] }),
        createApiAsset({ tags: ['models', 'loras'] }),
        createApiAsset({ tags: ['models', 'checkpoints'] }) // duplicate
      ]

      const { availableCategories } = useAssetBrowser(ref(assets))

      expect(availableCategories.value).toEqual([
        { id: 'all', label: 'All Models', icon: 'icon-[lucide--folder]' },
        {
          id: 'checkpoints',
          label: 'Checkpoints',
          icon: 'icon-[lucide--package]'
        },
        { id: 'loras', label: 'Loras', icon: 'icon-[lucide--package]' }
      ])
    })

    it('handles assets with no category tag', () => {
      const assets = [
        createApiAsset({ tags: ['models'] }), // No second tag
        createApiAsset({ tags: ['models', 'vae'] })
      ]

      const { availableCategories } = useAssetBrowser(ref(assets))

      expect(availableCategories.value).toEqual([
        { id: 'all', label: 'All Models', icon: 'icon-[lucide--folder]' },
        { id: 'vae', label: 'Vae', icon: 'icon-[lucide--package]' }
      ])
    })

    it('ignores non-models root tags', () => {
      const assets = [
        createApiAsset({ tags: ['input', 'images'] }),
        createApiAsset({ tags: ['models', 'checkpoints'] })
      ]

      const { availableCategories } = useAssetBrowser(ref(assets))

      expect(availableCategories.value).toEqual([
        { id: 'all', label: 'All Models', icon: 'icon-[lucide--folder]' },
        {
          id: 'checkpoints',
          label: 'Checkpoints',
          icon: 'icon-[lucide--package]'
        }
      ])
    })

    it('computes content title from selected category', () => {
      const assets = [createApiAsset({ tags: ['models', 'checkpoints'] })]
      const { selectedCategory, contentTitle } = useAssetBrowser(ref(assets))

      // Default
      expect(contentTitle.value).toBe('All Models')

      // Set specific category
      selectedCategory.value = 'checkpoints'
      expect(contentTitle.value).toBe('Checkpoints')

      // Unknown category
      selectedCategory.value = 'unknown'
      expect(contentTitle.value).toBe('Assets')
    })
  })
})
