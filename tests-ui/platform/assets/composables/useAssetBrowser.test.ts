import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useAssetBrowser } from '@/platform/assets/composables/useAssetBrowser'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetDetails: vi.fn()
  }
}))

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

  describe('Async Asset Selection with Detail Fetching', () => {
    it('should fetch asset details and call onSelect with filename when provided', async () => {
      const onSelectSpy = vi.fn()
      const asset = createApiAsset({
        id: 'asset-123',
        name: 'test-model.safetensors'
      })

      const detailAsset = createApiAsset({
        id: 'asset-123',
        name: 'test-model.safetensors',
        user_metadata: { filename: 'checkpoints/test-model.safetensors' }
      })
      vi.mocked(assetService.getAssetDetails).mockResolvedValue(detailAsset)

      const { selectAssetWithCallback } = useAssetBrowser([asset])

      await selectAssetWithCallback(asset.id, onSelectSpy)

      expect(assetService.getAssetDetails).toHaveBeenCalledWith('asset-123')
      expect(onSelectSpy).toHaveBeenCalledWith(
        'checkpoints/test-model.safetensors'
      )
    })

    it('should handle missing user_metadata.filename as error', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const onSelectSpy = vi.fn()
      const asset = createApiAsset({ id: 'asset-456' })

      const detailAsset = createApiAsset({
        id: 'asset-456',
        user_metadata: { filename: '' } // Invalid empty filename
      })
      vi.mocked(assetService.getAssetDetails).mockResolvedValue(detailAsset)

      const { selectAssetWithCallback } = useAssetBrowser([asset])

      await selectAssetWithCallback(asset.id, onSelectSpy)

      expect(assetService.getAssetDetails).toHaveBeenCalledWith('asset-456')
      expect(onSelectSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid asset filename:',
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Filename cannot be empty'
          })
        ]),
        'for asset:',
        'asset-456'
      )
    })

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const onSelectSpy = vi.fn()
      const asset = createApiAsset({ id: 'asset-789' })

      const apiError = new Error('API Error')
      vi.mocked(assetService.getAssetDetails).mockRejectedValue(apiError)

      const { selectAssetWithCallback } = useAssetBrowser([asset])

      await selectAssetWithCallback(asset.id, onSelectSpy)

      expect(assetService.getAssetDetails).toHaveBeenCalledWith('asset-789')
      expect(onSelectSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch asset details for asset-789'),
        apiError
      )
    })

    it('should not fetch details when no callback provided', async () => {
      const asset = createApiAsset({ id: 'asset-no-callback' })

      const { selectAssetWithCallback } = useAssetBrowser([asset])

      await selectAssetWithCallback(asset.id)

      expect(assetService.getAssetDetails).not.toHaveBeenCalled()
    })
  })

  describe('Filename Validation Security', () => {
    const createValidationTest = (filename: string) => {
      const testAsset = createApiAsset({ id: 'validation-test' })
      const detailAsset = createApiAsset({
        id: 'validation-test',
        user_metadata: { filename }
      })
      return { testAsset, detailAsset }
    }

    it('accepts valid file paths with forward slashes', async () => {
      const onSelectSpy = vi.fn()
      const { testAsset, detailAsset } = createValidationTest(
        'models/checkpoints/v1/test-model.safetensors'
      )
      vi.mocked(assetService.getAssetDetails).mockResolvedValue(detailAsset)

      const { selectAssetWithCallback } = useAssetBrowser([testAsset])
      await selectAssetWithCallback(testAsset.id, onSelectSpy)

      expect(onSelectSpy).toHaveBeenCalledWith(
        'models/checkpoints/v1/test-model.safetensors'
      )
    })

    it('rejects directory traversal attacks', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const onSelectSpy = vi.fn()

      const maliciousPaths = [
        '../malicious-model.safetensors',
        'models/../../../etc/passwd',
        '/etc/passwd'
      ]

      for (const path of maliciousPaths) {
        const { testAsset, detailAsset } = createValidationTest(path)
        vi.mocked(assetService.getAssetDetails).mockResolvedValue(detailAsset)

        const { selectAssetWithCallback } = useAssetBrowser([testAsset])
        await selectAssetWithCallback(testAsset.id, onSelectSpy)

        expect(onSelectSpy).not.toHaveBeenCalled()
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Invalid asset filename:',
          expect.arrayContaining([
            expect.objectContaining({
              message: 'Path must not start with / or contain ..'
            })
          ]),
          'for asset:',
          'validation-test'
        )
      }
    })

    it('rejects invalid filename characters', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const onSelectSpy = vi.fn()

      const invalidChars = ['\\', ':', '*', '?', '"', '<', '>', '|']

      for (const char of invalidChars) {
        const { testAsset, detailAsset } = createValidationTest(
          `bad${char}filename.safetensors`
        )
        vi.mocked(assetService.getAssetDetails).mockResolvedValue(detailAsset)

        const { selectAssetWithCallback } = useAssetBrowser([testAsset])
        await selectAssetWithCallback(testAsset.id, onSelectSpy)

        expect(onSelectSpy).not.toHaveBeenCalled()
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Invalid asset filename:',
          expect.arrayContaining([
            expect.objectContaining({
              message: 'Invalid filename characters'
            })
          ]),
          'for asset:',
          'validation-test'
        )
      }
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
