import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useWidgetSelectItems } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'

const mockAssetsData = vi.hoisted(() => ({ items: [] as AssetItem[] }))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useAssetWidgetData',
  () => ({
    useAssetWidgetData: () => ({
      category: computed(() => 'checkpoints'),
      assets: computed(() => mockAssetsData.items),
      isLoading: computed(() => false),
      error: computed(() => null)
    })
  })
)

const mockResolveOutputAssetItems = vi.fn()

function createMockMediaAssets() {
  return {
    media: ref<AssetItem[]>([]),
    loading: ref(false),
    error: ref(null),
    fetchMediaList: vi.fn().mockResolvedValue([]),
    refresh: vi.fn().mockResolvedValue([]),
    loadMore: vi.fn(),
    hasMore: ref(false),
    isLoadingMore: ref(false)
  }
}

let mockMediaAssets = createMockMediaAssets()

vi.mock('@/platform/assets/composables/media/useMediaAssets', () => ({
  useMediaAssets: () => mockMediaAssets
}))

vi.mock('@/platform/assets/composables/useAssetFilterOptions', () => ({
  useAssetFilterOptions: () => ({
    ownershipOptions: computed(() => []),
    availableBaseModels: computed(() => []),
    availableFileFormats: computed(() => [])
  })
}))

vi.mock('@/platform/assets/utils/outputAssetUtil', () => ({
  resolveOutputAssetItems: (...args: unknown[]) =>
    mockResolveOutputAssetItems(...args)
}))

function createDefaultOptions(
  overrides: Partial<Parameters<typeof useWidgetSelectItems>[0]> = {}
) {
  return {
    values: () => ['img_001.png', 'photo_abc.jpg', 'hash789.png'],
    getOptionLabel: () =>
      undefined as ((value?: string | null) => string) | undefined,
    modelValue: ref<string | undefined>('img_001.png'),
    assetKind: () => 'image' as const,
    outputMediaAssets: mockMediaAssets,
    assetData: null,
    isAssetMode: () => false,
    ...overrides
  }
}

describe('display label behavior', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('uses values as labels when no label function provided', () => {
    const { dropdownItems } = useWidgetSelectItems(createDefaultOptions())
    expect(dropdownItems.value[0]).toMatchObject({
      name: 'img_001.png',
      label: 'img_001.png'
    })
  })

  it('applies custom label function', () => {
    const getOptionLabel = (v?: string | null) => `Custom: ${v}`
    const { dropdownItems } = useWidgetSelectItems(
      createDefaultOptions({ getOptionLabel: () => getOptionLabel })
    )
    expect(dropdownItems.value[0].label).toBe('Custom: img_001.png')
  })

  it('falls back to value on label function error', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})
    const getOptionLabel = (v?: string | null) => {
      if (v === 'photo_abc.jpg') throw new Error('fail')
      return `Labeled: ${v}`
    }
    const { dropdownItems } = useWidgetSelectItems(
      createDefaultOptions({ getOptionLabel: () => getOptionLabel })
    )
    expect(dropdownItems.value[0].label).toBe('Labeled: img_001.png')
    expect(dropdownItems.value[1].label).toBe('photo_abc.jpg')
    expect(dropdownItems.value[2].label).toBe('Labeled: hash789.png')
    expect(consoleWarnSpy).toHaveBeenCalled()
    consoleWarnSpy.mockRestore()
  })

  it('falls back to value when label function returns empty string', () => {
    const getOptionLabel = (v?: string | null) => {
      if (v === 'photo_abc.jpg') return ''
      return `Labeled: ${v}`
    }
    const { dropdownItems } = useWidgetSelectItems(
      createDefaultOptions({ getOptionLabel: () => getOptionLabel })
    )
    expect(dropdownItems.value[1].label).toBe('photo_abc.jpg')
  })

  it('falls back to value when label function returns undefined', () => {
    const getOptionLabel = (v?: string | null) => {
      if (v === 'hash789.png') return undefined as unknown as string
      return `Labeled: ${v}`
    }
    const { dropdownItems } = useWidgetSelectItems(
      createDefaultOptions({ getOptionLabel: () => getOptionLabel })
    )
    expect(dropdownItems.value[2].label).toBe('hash789.png')
  })
})

describe('useWidgetSelectItems', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockMediaAssets = createMockMediaAssets()
    mockResolveOutputAssetItems.mockReset()
    mockAssetsData.items = []
  })

  describe('dropdownItems', () => {
    it('maps values to items with names as labels', () => {
      const { dropdownItems } = useWidgetSelectItems(createDefaultOptions())
      expect(dropdownItems.value).toHaveLength(3)
      expect(dropdownItems.value[0]).toMatchObject({
        name: 'img_001.png',
        label: 'img_001.png'
      })
    })

    it('returns empty when values is undefined and no modelValue', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => undefined,
          modelValue: ref(undefined)
        })
      )
      expect(dropdownItems.value).toHaveLength(0)
    })
  })

  describe('missing value handling', () => {
    it('creates fallback item when modelValue not in inputs', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => ['img_001.png', 'photo_abc.jpg'],
          modelValue: ref('template_image.png')
        })
      )
      expect(
        dropdownItems.value.some((item) => item.name === 'template_image.png')
      ).toBe(true)
      expect(dropdownItems.value[0].id).toBe('missing-template_image.png')
    })

    it('does not include fallback when filter is inputs', async () => {
      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => ['img_001.png', 'photo_abc.jpg'],
          modelValue: ref('template_image.png')
        })
      )
      filterSelected.value = 'inputs'
      await nextTick()

      expect(dropdownItems.value).toHaveLength(2)
      expect(
        dropdownItems.value.every(
          (item) => !String(item.id).startsWith('missing-')
        )
      ).toBe(true)
    })

    it('does not include fallback when filter is outputs', async () => {
      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => ['img_001.png', 'photo_abc.jpg'],
          modelValue: ref('template_image.png')
        })
      )
      filterSelected.value = 'outputs'
      await nextTick()

      expect(
        dropdownItems.value.every(
          (item) => !String(item.id).startsWith('missing-')
        )
      ).toBe(true)
    })

    it('no fallback when modelValue exists in inputs', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => ['img_001.png', 'photo_abc.jpg'],
          modelValue: ref('img_001.png')
        })
      )
      expect(dropdownItems.value).toHaveLength(2)
      expect(
        dropdownItems.value.every(
          (item) => !String(item.id).startsWith('missing-')
        )
      ).toBe(true)
    })

    it('no fallback when modelValue is undefined', () => {
      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => ['img_001.png', 'photo_abc.jpg'],
          modelValue: ref(undefined)
        })
      )
      expect(dropdownItems.value).toHaveLength(2)
      expect(
        dropdownItems.value.every(
          (item) => !String(item.id).startsWith('missing-')
        )
      ).toBe(true)
    })
  })

  describe('cloud asset mode', () => {
    const createTestAsset = (
      id: string,
      name: string,
      preview_url: string
    ): AssetItem => ({
      id,
      name,
      preview_url,
      tags: []
    })

    it('excludes missing items from cloud dropdown', () => {
      mockAssetsData.items = [
        createTestAsset(
          'asset-1',
          'existing_model.safetensors',
          'https://example.com/preview.jpg'
        )
      ]

      const assetData = {
        category: computed(() => 'checkpoints'),
        assets: computed(() => mockAssetsData.items),
        isLoading: computed(() => false),
        error: computed(() => null)
      }

      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('missing_model.safetensors'),
          assetKind: () => 'model',
          isAssetMode: () => true,
          assetData
        })
      )

      expect(dropdownItems.value).toHaveLength(1)
      expect(dropdownItems.value[0].name).toBe('existing_model.safetensors')
    })

    it('shows only available cloud assets', () => {
      mockAssetsData.items = [
        createTestAsset(
          'asset-1',
          'model_a.safetensors',
          'https://example.com/a.jpg'
        ),
        createTestAsset(
          'asset-2',
          'model_b.safetensors',
          'https://example.com/b.jpg'
        )
      ]

      const assetData = {
        category: computed(() => 'checkpoints'),
        assets: computed(() => mockAssetsData.items),
        isLoading: computed(() => false),
        error: computed(() => null)
      }

      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('model_a.safetensors'),
          assetKind: () => 'model',
          isAssetMode: () => true,
          assetData
        })
      )

      expect(dropdownItems.value).toHaveLength(2)
      expect(dropdownItems.value.map((i) => i.name)).toEqual([
        'model_a.safetensors',
        'model_b.safetensors'
      ])
    })

    it('returns empty dropdown when no cloud assets', () => {
      const assetData = {
        category: computed(() => 'checkpoints'),
        assets: computed(() => [] as AssetItem[]),
        isLoading: computed(() => false),
        error: computed(() => null)
      }

      const { dropdownItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('missing.safetensors'),
          assetKind: () => 'model',
          isAssetMode: () => true,
          assetData
        })
      )

      expect(dropdownItems.value).toHaveLength(0)
    })

    it('includes missing cloud asset in displayItems', () => {
      mockAssetsData.items = [
        createTestAsset(
          'asset-1',
          'existing_model.safetensors',
          'https://example.com/preview.jpg'
        )
      ]

      const assetData = {
        category: computed(() => 'checkpoints'),
        assets: computed(() => mockAssetsData.items),
        isLoading: computed(() => false),
        error: computed(() => null)
      }

      const { displayItems, selectedSet } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('missing_model.safetensors'),
          assetKind: () => 'model',
          isAssetMode: () => true,
          assetData
        })
      )

      expect(displayItems.value).toHaveLength(2)
      expect(displayItems.value[0].name).toBe('missing_model.safetensors')
      expect(displayItems.value[0].id).toBe('missing-missing_model.safetensors')
      expect(selectedSet.value.has('missing-missing_model.safetensors')).toBe(
        true
      )
    })
  })

  describe('multi-output jobs', () => {
    function makeMultiOutputAsset(
      jobId: string,
      name: string,
      nodeId: string,
      outputCount: number
    ) {
      return {
        id: jobId,
        name,
        preview_url: `/api/view?filename=${name}&type=output`,
        tags: ['output'],
        user_metadata: {
          jobId,
          nodeId,
          subfolder: '',
          outputCount,
          allOutputs: [
            {
              filename: name,
              subfolder: '',
              type: 'output',
              nodeId,
              mediaType: 'images'
            }
          ]
        }
      }
    }

    it('shows all outputs after resolving multi-output jobs', async () => {
      mockMediaAssets.media.value = [
        makeMultiOutputAsset('job-1', 'preview.png', '5', 3)
      ]

      mockResolveOutputAssetItems.mockResolvedValue([
        {
          id: 'job-1-5-output_001.png',
          name: 'output_001.png',
          preview_url: '/api/view?filename=output_001.png&type=output',
          tags: ['output']
        },
        {
          id: 'job-1-5-output_002.png',
          name: 'output_002.png',
          preview_url: '/api/view?filename=output_002.png&type=output',
          tags: ['output']
        },
        {
          id: 'job-1-5-output_003.png',
          name: 'output_003.png',
          preview_url: '/api/view?filename=output_003.png&type=output',
          tags: ['output']
        }
      ])

      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('output_001.png')
        })
      )
      filterSelected.value = 'outputs'

      await vi.waitFor(() => {
        expect(dropdownItems.value).toHaveLength(3)
      })

      expect(dropdownItems.value.map((i) => i.name)).toEqual([
        'output_001.png [output]',
        'output_002.png [output]',
        'output_003.png [output]'
      ])
    })

    it('shows preview when job has only one output', async () => {
      mockMediaAssets.media.value = [
        makeMultiOutputAsset('job-2', 'single.png', '3', 1)
      ]

      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('single.png')
        })
      )
      filterSelected.value = 'outputs'
      await nextTick()

      expect(dropdownItems.value).toHaveLength(1)
      expect(dropdownItems.value[0].name).toBe('single.png [output]')
      expect(mockResolveOutputAssetItems).not.toHaveBeenCalled()
    })

    it('resolves two multi-output jobs independently', async () => {
      mockMediaAssets.media.value = [
        makeMultiOutputAsset('job-A', 'previewA.png', '1', 2),
        makeMultiOutputAsset('job-B', 'previewB.png', '2', 2)
      ]

      mockResolveOutputAssetItems.mockImplementation(
        async (meta: { jobId: string }) => {
          if (meta.jobId === 'job-A') {
            return [
              {
                id: 'A-1',
                name: 'a1.png',
                preview_url: '',
                tags: ['output']
              },
              {
                id: 'A-2',
                name: 'a2.png',
                preview_url: '',
                tags: ['output']
              }
            ]
          }
          return [
            {
              id: 'B-1',
              name: 'b1.png',
              preview_url: '',
              tags: ['output']
            },
            {
              id: 'B-2',
              name: 'b2.png',
              preview_url: '',
              tags: ['output']
            }
          ]
        }
      )

      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )
      filterSelected.value = 'outputs'

      await vi.waitFor(() => {
        expect(dropdownItems.value).toHaveLength(4)
      })

      const names = dropdownItems.value.map((i) => i.name)
      expect(names).toContain('a1.png [output]')
      expect(names).toContain('a2.png [output]')
      expect(names).toContain('b1.png [output]')
      expect(names).toContain('b2.png [output]')
    })

    it('resolves outputs when allOutputs already contains all items', async () => {
      mockMediaAssets.media.value = [
        {
          id: 'job-complete',
          name: 'preview.png',
          preview_url: '/api/view?filename=preview.png&type=output',
          tags: ['output'],
          user_metadata: {
            jobId: 'job-complete',
            nodeId: '1',
            subfolder: '',
            outputCount: 2,
            allOutputs: [
              {
                filename: 'out1.png',
                subfolder: '',
                type: 'output',
                nodeId: '1',
                mediaType: 'images'
              },
              {
                filename: 'out2.png',
                subfolder: '',
                type: 'output',
                nodeId: '1',
                mediaType: 'images'
              }
            ]
          }
        }
      ]

      mockResolveOutputAssetItems.mockResolvedValue([
        {
          id: 'c-1',
          name: 'out1.png',
          preview_url: '',
          tags: ['output']
        },
        {
          id: 'c-2',
          name: 'out2.png',
          preview_url: '',
          tags: ['output']
        }
      ])

      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )
      filterSelected.value = 'outputs'

      await vi.waitFor(() => {
        expect(dropdownItems.value).toHaveLength(2)
      })

      expect(mockResolveOutputAssetItems).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job-complete' }),
        expect.any(Object)
      )
      const names = dropdownItems.value.map((i) => i.name)
      expect(names).toEqual(['out1.png [output]', 'out2.png [output]'])
    })

    it('falls back to preview when resolver rejects', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      mockMediaAssets.media.value = [
        makeMultiOutputAsset('job-fail', 'preview.png', '1', 3)
      ]
      mockResolveOutputAssetItems.mockRejectedValue(new Error('network error'))

      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )
      filterSelected.value = 'outputs'

      await vi.waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to resolve multi-output job',
          'job-fail',
          expect.any(Error)
        )
      })

      expect(dropdownItems.value).toHaveLength(1)
      expect(dropdownItems.value[0].name).toBe('preview.png [output]')
      consoleWarnSpy.mockRestore()
    })
  })

  describe('FE-228: output dropdown label uses human-readable filename', () => {
    it('renders metadata.filename in label when asset.name is a hash', async () => {
      mockMediaAssets.media.value = [
        {
          id: 'asset-hash-1',
          name: 'a1ef7d292026e89ce9bbbd8093e2d0ed6a8850361a0c22e49522ac7baa5494e5.png',
          asset_hash:
            'a1ef7d292026e89ce9bbbd8093e2d0ed6a8850361a0c22e49522ac7baa5494e5',
          preview_url: '/preview.png',
          tags: ['output'],
          metadata: {
            filename: 'sunset_photo.png'
          }
        }
      ]

      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )
      filterSelected.value = 'outputs'
      await nextTick()

      expect(dropdownItems.value).toHaveLength(1)
      expect(dropdownItems.value[0].label).toBe('sunset_photo.png [output]')
    })

    it('renders asset.display_name in label when queue-mapped asset lacks metadata.filename', async () => {
      mockMediaAssets.media.value = [
        {
          id: 'job-1',
          name: 'a1ef7d292026e89ce9bbbd8093e2d0ed6a8850361a0c22e49522ac7baa5494e5.png',
          display_name: 'ComfyUI-90_right_00001_.png',
          preview_url: '/preview.png',
          tags: ['output'],
          user_metadata: {
            jobId: 'job-1',
            nodeId: '5',
            subfolder: ''
          }
        }
      ]

      const { dropdownItems, filterSelected } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )
      filterSelected.value = 'outputs'
      await nextTick()

      expect(dropdownItems.value).toHaveLength(1)
      expect(dropdownItems.value[0].label).toBe(
        'ComfyUI-90_right_00001_.png [output]'
      )
      expect(dropdownItems.value[0].name).toMatch(
        /^a1ef7d29.*\.png \[output\]$/
      )
    })
  })

  describe('selectedSet', () => {
    beforeEach(() => {
      setActivePinia(createTestingPinia({ stubActions: false }))
    })

    it('returns empty set when modelValue is undefined', () => {
      const { selectedSet } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref(undefined)
        })
      )
      expect(selectedSet.value.size).toBe(0)
    })

    it('returns set with matching item id when modelValue matches', () => {
      const { selectedSet } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref('img_001.png')
        })
      )
      expect(selectedSet.value.size).toBe(1)
      expect(selectedSet.value.has('input-0')).toBe(true)
    })

    it('returns set with missing item id when modelValue matches no input', () => {
      const { selectedSet } = useWidgetSelectItems(
        createDefaultOptions({
          modelValue: ref('nonexistent.png'),
          values: () => ['img_001.png']
        })
      )
      expect(selectedSet.value.size).toBe(1)
      expect(selectedSet.value.has('missing-nonexistent.png')).toBe(true)
    })
  })
})
