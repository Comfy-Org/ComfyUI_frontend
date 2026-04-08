import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getDisplayLabel,
  useWidgetSelectItems
} from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'

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

const { mockMediaAssets, mockResolveOutputAssetItems } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    mockMediaAssets: {
      media: ref([]),
      loading: ref(false),
      error: ref(null),
      fetchMediaList: vi.fn().mockResolvedValue([]),
      refresh: vi.fn().mockResolvedValue([]),
      loadMore: vi.fn(),
      hasMore: ref(false),
      isLoadingMore: ref(false)
    },
    mockResolveOutputAssetItems: vi.fn()
  }
})

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

function createDefaultOptions(overrides: Record<string, unknown> = {}) {
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

describe('getDisplayLabel', () => {
  it('returns value when no label function', () => {
    expect(getDisplayLabel('test.png')).toBe('test.png')
  })

  it('applies label function', () => {
    const labelFn = (v?: string | null) => `Custom: ${v}`
    expect(getDisplayLabel('test.png', labelFn)).toBe('Custom: test.png')
  })

  it('falls back to value on error', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const labelFn = () => {
      throw new Error('fail')
    }
    expect(getDisplayLabel('test.png', labelFn)).toBe('test.png')
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('falls back to value when label function returns empty string', () => {
    const labelFn = () => ''
    expect(getDisplayLabel('test.png', labelFn)).toBe('test.png')
  })
})

describe('useWidgetSelectItems', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockMediaAssets.media.value = []
    mockResolveOutputAssetItems.mockReset()
    mockAssetsData.items = []
  })

  describe('inputItems', () => {
    it('maps values to FormDropdownItems with names as labels', () => {
      const { inputItems } = useWidgetSelectItems(createDefaultOptions())
      expect(inputItems.value).toHaveLength(3)
      expect(inputItems.value[0]).toMatchObject({
        name: 'img_001.png',
        label: 'img_001.png'
      })
    })

    it('applies custom label mapping', () => {
      const getOptionLabel = vi.fn((v?: string | null) => `Custom: ${v}`)
      const { inputItems } = useWidgetSelectItems(
        createDefaultOptions({
          getOptionLabel: () => getOptionLabel
        })
      )
      expect(inputItems.value[0].label).toBe('Custom: img_001.png')
      expect(inputItems.value[1].label).toBe('Custom: photo_abc.jpg')
    })

    it('falls back when label mapping fails for one value', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const getOptionLabel = vi.fn((v?: string | null) => {
        if (v === 'photo_abc.jpg') throw new Error('fail')
        return `Labeled: ${v}`
      })
      const { inputItems } = useWidgetSelectItems(
        createDefaultOptions({
          getOptionLabel: () => getOptionLabel
        })
      )
      expect(inputItems.value[0].label).toBe('Labeled: img_001.png')
      expect(inputItems.value[1].label).toBe('photo_abc.jpg')
      expect(inputItems.value[2].label).toBe('Labeled: hash789.png')
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('falls back when label mapping returns empty string', () => {
      const getOptionLabel = vi.fn((v?: string | null) => {
        if (v === 'photo_abc.jpg') return ''
        return `Labeled: ${v}`
      })
      const { inputItems } = useWidgetSelectItems(
        createDefaultOptions({
          getOptionLabel: () => getOptionLabel
        })
      )
      expect(inputItems.value[1].label).toBe('photo_abc.jpg')
    })

    it('falls back when label mapping returns undefined', () => {
      const getOptionLabel = vi.fn((v?: string | null) => {
        if (v === 'hash789.png') return undefined as unknown as string
        return `Labeled: ${v}`
      })
      const { inputItems } = useWidgetSelectItems(
        createDefaultOptions({
          getOptionLabel: () => getOptionLabel
        })
      )
      expect(inputItems.value[2].label).toBe('hash789.png')
    })

    it('returns empty array for non-array values', () => {
      const { inputItems } = useWidgetSelectItems(
        createDefaultOptions({ values: () => undefined })
      )
      expect(inputItems.value).toHaveLength(0)
    })
  })

  describe('outputItems with custom labels', () => {
    it('applies custom label mapping to output items', () => {
      const getOptionLabel = vi.fn((v?: string | null) => `Output: ${v}`)
      const { outputItems } = useWidgetSelectItems(
        createDefaultOptions({
          getOptionLabel: () => getOptionLabel
        })
      )
      expect(outputItems.value).toBeDefined()
      expect(Array.isArray(outputItems.value)).toBe(true)
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
      const { dropdownItems, filterSelected, outputItems } =
        useWidgetSelectItems(
          createDefaultOptions({
            values: () => ['img_001.png', 'photo_abc.jpg'],
            modelValue: ref('template_image.png')
          })
        )
      filterSelected.value = 'outputs'
      await nextTick()

      expect(dropdownItems.value).toHaveLength(outputItems.value.length)
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

      const { outputItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('output_001.png')
        })
      )

      await vi.waitFor(() => {
        expect(outputItems.value).toHaveLength(3)
      })

      expect(outputItems.value.map((i) => i.name)).toEqual([
        'output_001.png [output]',
        'output_002.png [output]',
        'output_003.png [output]'
      ])
    })

    it('shows preview when job has only one output', () => {
      mockMediaAssets.media.value = [
        makeMultiOutputAsset('job-2', 'single.png', '3', 1)
      ]

      const { outputItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref('single.png')
        })
      )

      expect(outputItems.value).toHaveLength(1)
      expect(outputItems.value[0].name).toBe('single.png [output]')
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

      const { outputItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )

      await vi.waitFor(() => {
        expect(outputItems.value).toHaveLength(4)
      })

      const names = outputItems.value.map((i) => i.name)
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

      const { outputItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )

      await vi.waitFor(() => {
        expect(outputItems.value).toHaveLength(2)
      })

      expect(mockResolveOutputAssetItems).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 'job-complete' }),
        expect.any(Object)
      )
      const names = outputItems.value.map((i) => i.name)
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

      const { outputItems } = useWidgetSelectItems(
        createDefaultOptions({
          values: () => [],
          modelValue: ref(undefined)
        })
      )

      await vi.waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to resolve multi-output job',
          'job-fail',
          expect.any(Error)
        )
      })

      expect(outputItems.value).toHaveLength(1)
      expect(outputItems.value[0].name).toBe('preview.png [output]')
      consoleWarnSpy.mockRestore()
    })
  })
})
