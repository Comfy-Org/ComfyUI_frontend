import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

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

      const { selectedCategory, categoryFilteredAssets } = useAssetBrowser([
        checkpointAsset,
        loraAsset
      ])

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
        size: 2147483648, // 2GB
        user_metadata: { description: 'Test model' }
      })

      const { filteredAssets } = useAssetBrowser([apiAsset])
      const result = filteredAssets.value[0] // Get the transformed asset from filteredAssets

      // Preserves API properties
      expect(result.id).toBe(apiAsset.id)
      expect(result.name).toBe(apiAsset.name)

      // Adds display properties
      expect(result.description).toBe('Test model')
      expect(result.formattedSize).toBe('2 GB')
      expect(result.badges).toContainEqual({
        label: 'checkpoints',
        type: 'type'
      })
      expect(result.badges).toContainEqual({ label: '2 GB', type: 'size' })
    })

    it('creates fallback description from tags when metadata missing', () => {
      const apiAsset = createApiAsset({
        tags: ['models', 'loras'],
        user_metadata: undefined
      })

      const { filteredAssets } = useAssetBrowser([apiAsset])
      const result = filteredAssets.value[0]

      expect(result.description).toBe('loras model')
    })

    it('formats various file sizes correctly', () => {
      const testCases = [
        { size: 512, expected: '512 B' },
        { size: 1536, expected: '1.5 KB' },
        { size: 2097152, expected: '2 MB' },
        { size: 3221225472, expected: '3 GB' }
      ]

      testCases.forEach(({ size, expected }) => {
        const asset = createApiAsset({ size })
        const { filteredAssets } = useAssetBrowser([asset])
        const result = filteredAssets.value[0]
        expect(result.formattedSize).toBe(expected)
      })
    })
  })

  describe('Tag-Based Filtering', () => {
    it('filters assets by category tag', async () => {
      const assets = [
        createApiAsset({ id: '1', tags: ['models', 'checkpoints'] }),
        createApiAsset({ id: '2', tags: ['models', 'loras'] }),
        createApiAsset({ id: '3', tags: ['models', 'checkpoints'] })
      ]

      const { selectedCategory, filteredAssets } = useAssetBrowser(assets)

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

      const { selectedCategory, filteredAssets } = useAssetBrowser(assets)

      selectedCategory.value = 'all'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(2)
    })
  })

  describe('Search Functionality', () => {
    it('searches across asset name', async () => {
      const assets = [
        createApiAsset({ name: 'realistic_vision.safetensors' }),
        createApiAsset({ name: 'anime_style.ckpt' }),
        createApiAsset({ name: 'photorealistic_v2.safetensors' })
      ]

      const { searchQuery, filteredAssets } = useAssetBrowser(assets)

      searchQuery.value = 'realistic'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(2)
      expect(
        filteredAssets.value.every((asset) =>
          asset.name.toLowerCase().includes('realistic')
        )
      ).toBe(true)
    })

    it('searches in user metadata description', async () => {
      const assets = [
        createApiAsset({
          name: 'model1.safetensors',
          user_metadata: { description: 'fantasy artwork model' }
        }),
        createApiAsset({
          name: 'model2.safetensors',
          user_metadata: { description: 'portrait photography' }
        })
      ]

      const { searchQuery, filteredAssets } = useAssetBrowser(assets)

      searchQuery.value = 'fantasy'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(1)
      expect(filteredAssets.value[0].name).toBe('model1.safetensors')
    })

    it('handles empty search results', async () => {
      const assets = [createApiAsset({ name: 'test.safetensors' })]

      const { searchQuery, filteredAssets } = useAssetBrowser(assets)

      searchQuery.value = 'nonexistent'
      await nextTick()

      expect(filteredAssets.value).toHaveLength(0)
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

      const { searchQuery, selectedCategory, filteredAssets } =
        useAssetBrowser(assets)

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

      const { updateFilters, filteredAssets } = useAssetBrowser(assets)

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

      const { updateFilters, filteredAssets } = useAssetBrowser(assets)

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

      const { availableCategories } = useAssetBrowser(assets)

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

      const { availableCategories } = useAssetBrowser(assets)

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

      const { availableCategories } = useAssetBrowser(assets)

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
      const { selectedCategory, contentTitle } = useAssetBrowser(assets)

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
