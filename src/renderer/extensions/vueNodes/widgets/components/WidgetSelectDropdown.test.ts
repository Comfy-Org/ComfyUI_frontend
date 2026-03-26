import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { computed } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetSelectDropdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue'
import { createMockWidget } from './widgetTestUtils'

const mockCheckState = vi.hoisted(() => vi.fn())
const mockAssetsData = vi.hoisted(() => ({ items: [] as AssetItem[] }))

vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const actual = await vi.importActual(
    '@/platform/workflow/management/stores/workflowStore'
  )
  return {
    ...actual,
    useWorkflowStore: () => ({
      activeWorkflow: {
        changeTracker: {
          checkState: mockCheckState
        }
      }
    })
  }
})

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    apiURL: vi.fn((url: string) => url),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

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

vi.mock('@/platform/assets/utils/outputAssetUtil', () => ({
  resolveOutputAssetItems: (...args: unknown[]) =>
    mockResolveOutputAssetItems(...args)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

interface WidgetSelectDropdownInstance extends ComponentPublicInstance {
  inputItems: FormDropdownItem[]
  outputItems: FormDropdownItem[]
  dropdownItems: FormDropdownItem[]
  filterSelected: string
  updateSelectedItems: (selectedSet: Set<string>) => void
}

describe('WidgetSelectDropdown custom label mapping', () => {
  const createSelectDropdownWidget = (
    value: string = 'img_001.png',
    options: {
      values?: string[]
      getOptionLabel?: (value?: string | null) => string
    } = {},
    spec?: ComboInputSpec
  ) =>
    createMockWidget<string | undefined>({
      value,
      name: 'test_image_select',
      type: 'combo',
      options: {
        values: ['img_001.png', 'photo_abc.jpg', 'hash789.png'],
        ...options
      },
      spec
    })

  const mountComponent = (
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined,
    assetKind: 'image' | 'video' | 'audio' = 'image'
  ): VueWrapper<WidgetSelectDropdownInstance> => {
    return mount(WidgetSelectDropdown, {
      props: {
        widget,
        modelValue,
        assetKind,
        allowUpload: true,
        uploadFolder: 'input'
      },
      global: {
        plugins: [PrimeVue, createTestingPinia(), i18n]
      }
    }) as unknown as VueWrapper<WidgetSelectDropdownInstance>
  }

  describe('when custom labels are not provided', () => {
    it('uses values as labels when no mapping provided', () => {
      const widget = createSelectDropdownWidget('img_001.png')
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems).toHaveLength(3)
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('img_001.png')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('photo_abc.jpg')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('hash789.png')
    })
  })

  describe('when custom labels are provided via getOptionLabel', () => {
    it('displays custom labels while preserving original values', () => {
      const getOptionLabel = vi.fn((value?: string | null) => {
        if (!value) return 'No file'
        const mapping: Record<string, string> = {
          'img_001.png': 'Vacation Photo',
          'photo_abc.jpg': 'Family Portrait',
          'hash789.png': 'Sunset Beach'
        }
        return mapping[value] || value
      })

      const widget = createSelectDropdownWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems).toHaveLength(3)
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('Vacation Photo')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('Family Portrait')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('Sunset Beach')

      expect(getOptionLabel).toHaveBeenCalledWith('img_001.png')
      expect(getOptionLabel).toHaveBeenCalledWith('photo_abc.jpg')
      expect(getOptionLabel).toHaveBeenCalledWith('hash789.png')
    })

    it('emits original values when items with custom labels are selected', async () => {
      const getOptionLabel = vi.fn((value?: string | null) => {
        if (!value) return 'No file'
        return `Custom: ${value}`
      })

      const widget = createSelectDropdownWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      // Simulate selecting an item
      const selectedSet = new Set(['input-1']) // index 1 = photo_abc.jpg
      wrapper.vm.updateSelectedItems(selectedSet)

      // Should emit the original value, not the custom label
      expect(wrapper.emitted('update:modelValue')).toBeDefined()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([
        'photo_abc.jpg'
      ])
    })

    it('falls back to original value when label mapping fails', () => {
      const getOptionLabel = vi.fn((value?: string | null) => {
        if (value === 'photo_abc.jpg') {
          throw new Error('Mapping failed')
        }
        return `Labeled: ${value}`
      })

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const widget = createSelectDropdownWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('Labeled: img_001.png')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('photo_abc.jpg')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('Labeled: hash789.png')

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('falls back to original value when label mapping returns empty string', () => {
      const getOptionLabel = vi.fn((value?: string | null) => {
        if (value === 'photo_abc.jpg') {
          return ''
        }
        return `Labeled: ${value}`
      })

      const widget = createSelectDropdownWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('Labeled: img_001.png')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('photo_abc.jpg')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('Labeled: hash789.png')
    })

    it('falls back to original value when label mapping returns undefined', () => {
      const getOptionLabel = vi.fn((value?: string | null) => {
        if (value === 'hash789.png') {
          return undefined as unknown as string
        }
        return `Labeled: ${value}`
      })

      const widget = createSelectDropdownWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems[0].name).toBe('img_001.png')
      expect(inputItems[0].label).toBe('Labeled: img_001.png')
      expect(inputItems[1].name).toBe('photo_abc.jpg')
      expect(inputItems[1].label).toBe('Labeled: photo_abc.jpg')
      expect(inputItems[2].name).toBe('hash789.png')
      expect(inputItems[2].label).toBe('hash789.png')
    })
  })

  describe('output items with custom label mapping', () => {
    it('applies custom label mapping to output items from queue history', () => {
      const getOptionLabel = vi.fn((value?: string | null) => {
        if (!value) return 'No file'
        return `Output: ${value}`
      })

      const widget = createSelectDropdownWidget('img_001.png', {
        getOptionLabel
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const outputItems = wrapper.vm.outputItems
      expect(outputItems).toBeDefined()
      expect(Array.isArray(outputItems)).toBe(true)
    })
  })

  describe('missing value handling for template-loaded nodes', () => {
    it('creates a fallback item in "all" filter when modelValue is not in available items', () => {
      const widget = createSelectDropdownWidget('template_image.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'template_image.png')

      const inputItems = wrapper.vm.inputItems
      expect(inputItems).toHaveLength(2)
      expect(
        inputItems.some((item) => item.name === 'template_image.png')
      ).toBe(false)

      // The missing value should be accessible via dropdownItems when filter is 'all' (default)
      const dropdownItems = wrapper.vm.dropdownItems
      expect(
        dropdownItems.some((item) => item.name === 'template_image.png')
      ).toBe(true)
      expect(dropdownItems[0].name).toBe('template_image.png')
      expect(dropdownItems[0].id).toBe('missing-template_image.png')
    })

    it('does not include fallback item when filter is "inputs"', async () => {
      const widget = createSelectDropdownWidget('template_image.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'template_image.png')

      wrapper.vm.filterSelected = 'inputs'
      await wrapper.vm.$nextTick()

      const dropdownItems = wrapper.vm.dropdownItems
      expect(dropdownItems).toHaveLength(2)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })

    it('does not include fallback item when filter is "outputs"', async () => {
      const widget = createSelectDropdownWidget('template_image.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'template_image.png')

      wrapper.vm.filterSelected = 'outputs'
      await wrapper.vm.$nextTick()

      const dropdownItems = wrapper.vm.dropdownItems
      expect(dropdownItems).toHaveLength(wrapper.vm.outputItems.length)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })

    it('does not create a fallback item when modelValue exists in available items', () => {
      const widget = createSelectDropdownWidget('img_001.png', {
        values: ['img_001.png', 'photo_abc.jpg']
      })
      const wrapper = mountComponent(widget, 'img_001.png')

      const dropdownItems = wrapper.vm.dropdownItems
      expect(dropdownItems).toHaveLength(2)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })

    it('does not create a fallback item when modelValue is undefined', () => {
      const widget = createSelectDropdownWidget(
        undefined as unknown as string,
        {
          values: ['img_001.png', 'photo_abc.jpg']
        }
      )
      const wrapper = mountComponent(widget, undefined)

      const dropdownItems = wrapper.vm.dropdownItems
      expect(dropdownItems).toHaveLength(2)
      expect(
        dropdownItems.every((item) => !String(item.id).startsWith('missing-'))
      ).toBe(true)
    })
  })
})

describe('WidgetSelectDropdown cloud asset mode (COM-14333)', () => {
  interface CloudModeInstance extends ComponentPublicInstance {
    dropdownItems: FormDropdownItem[]
    displayItems: FormDropdownItem[]
    selectedSet: Set<string>
  }

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

  const createCloudModeWidget = (
    value: string = 'model.safetensors'
  ): SimplifiedWidget<string | undefined> => ({
    name: 'test_model_select',
    type: 'combo',
    value,
    options: {
      values: [],
      nodeType: 'CheckpointLoaderSimple'
    }
  })

  const mountCloudComponent = (
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined
  ): VueWrapper<CloudModeInstance> => {
    return mount(WidgetSelectDropdown, {
      props: {
        widget,
        modelValue,
        assetKind: 'model',
        isAssetMode: true,
        nodeType: 'CheckpointLoaderSimple'
      },
      global: {
        plugins: [PrimeVue, createTestingPinia(), i18n]
      }
    }) as unknown as VueWrapper<CloudModeInstance>
  }

  beforeEach(() => {
    mockAssetsData.items = []
  })

  it('does not include missing items in cloud asset mode dropdown', () => {
    mockAssetsData.items = [
      createTestAsset(
        'asset-1',
        'existing_model.safetensors',
        'https://example.com/preview.jpg'
      )
    ]

    const widget = createCloudModeWidget('missing_model.safetensors')
    const wrapper = mountCloudComponent(widget, 'missing_model.safetensors')

    const dropdownItems = wrapper.vm.dropdownItems
    expect(dropdownItems).toHaveLength(1)
    expect(dropdownItems[0].name).toBe('existing_model.safetensors')
    expect(
      dropdownItems.some((item) => item.name === 'missing_model.safetensors')
    ).toBe(false)
  })

  it('shows only available cloud assets in dropdown', () => {
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

    const widget = createCloudModeWidget('model_a.safetensors')
    const wrapper = mountCloudComponent(widget, 'model_a.safetensors')

    const dropdownItems = wrapper.vm.dropdownItems
    expect(dropdownItems).toHaveLength(2)
    expect(dropdownItems.map((item) => item.name)).toEqual([
      'model_a.safetensors',
      'model_b.safetensors'
    ])
  })

  it('returns empty dropdown when no cloud assets available', () => {
    mockAssetsData.items = []

    const widget = createCloudModeWidget('missing_model.safetensors')
    const wrapper = mountCloudComponent(widget, 'missing_model.safetensors')

    const dropdownItems = wrapper.vm.dropdownItems
    expect(dropdownItems).toHaveLength(0)
  })

  it('includes missing cloud asset in displayItems for input field visibility', () => {
    mockAssetsData.items = [
      createTestAsset(
        'asset-1',
        'existing_model.safetensors',
        'https://example.com/preview.jpg'
      )
    ]

    const widget = createCloudModeWidget('missing_model.safetensors')
    const wrapper = mountCloudComponent(widget, 'missing_model.safetensors')

    const displayItems = wrapper.vm.displayItems
    expect(displayItems).toHaveLength(2)
    expect(displayItems[0].name).toBe('missing_model.safetensors')
    expect(displayItems[0].id).toBe('missing-missing_model.safetensors')
    expect(displayItems[1].name).toBe('existing_model.safetensors')

    const selectedSet = wrapper.vm.selectedSet
    expect(selectedSet.has('missing-missing_model.safetensors')).toBe(true)
  })
})

describe('WidgetSelectDropdown multi-output jobs', () => {
  interface MultiOutputInstance extends ComponentPublicInstance {
    outputItems: FormDropdownItem[]
  }

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

  function mountMultiOutput(
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined
  ): VueWrapper<MultiOutputInstance> {
    return mount(WidgetSelectDropdown, {
      props: { widget, modelValue, assetKind: 'image' as const },
      global: { plugins: [PrimeVue, createTestingPinia(), i18n] }
    }) as unknown as VueWrapper<MultiOutputInstance>
  }

  const defaultWidget = () =>
    createMockWidget<string | undefined>({
      value: 'output_001.png',
      name: 'test_image',
      type: 'combo',
      options: { values: [] }
    })

  beforeEach(() => {
    mockMediaAssets.media.value = []
    mockResolveOutputAssetItems.mockReset()
  })

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

    const wrapper = mountMultiOutput(defaultWidget(), 'output_001.png')

    await vi.waitFor(() => {
      expect(wrapper.vm.outputItems).toHaveLength(3)
    })

    expect(wrapper.vm.outputItems.map((i) => i.name)).toEqual([
      'output_001.png [output]',
      'output_002.png [output]',
      'output_003.png [output]'
    ])
  })

  it('shows preview output when job has only one output', () => {
    mockMediaAssets.media.value = [
      makeMultiOutputAsset('job-2', 'single.png', '3', 1)
    ]

    const widget = createMockWidget<string | undefined>({
      value: 'single.png',
      name: 'test_image',
      type: 'combo',
      options: { values: [] }
    })
    const wrapper = mountMultiOutput(widget, 'single.png')

    expect(wrapper.vm.outputItems).toHaveLength(1)
    expect(wrapper.vm.outputItems[0].name).toBe('single.png [output]')
    expect(mockResolveOutputAssetItems).not.toHaveBeenCalled()
  })

  it('resolves two multi-output jobs independently', async () => {
    mockMediaAssets.media.value = [
      makeMultiOutputAsset('job-A', 'previewA.png', '1', 2),
      makeMultiOutputAsset('job-B', 'previewB.png', '2', 2)
    ]

    mockResolveOutputAssetItems.mockImplementation(async (meta) => {
      if (meta.jobId === 'job-A') {
        return [
          { id: 'A-1', name: 'a1.png', preview_url: '', tags: ['output'] },
          { id: 'A-2', name: 'a2.png', preview_url: '', tags: ['output'] }
        ]
      }
      return [
        { id: 'B-1', name: 'b1.png', preview_url: '', tags: ['output'] },
        { id: 'B-2', name: 'b2.png', preview_url: '', tags: ['output'] }
      ]
    })

    const wrapper = mountMultiOutput(defaultWidget(), undefined)

    await vi.waitFor(() => {
      expect(wrapper.vm.outputItems).toHaveLength(4)
    })

    const names = wrapper.vm.outputItems.map((i) => i.name)
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
      { id: 'c-1', name: 'out1.png', preview_url: '', tags: ['output'] },
      { id: 'c-2', name: 'out2.png', preview_url: '', tags: ['output'] }
    ])

    const wrapper = mountMultiOutput(defaultWidget(), undefined)

    await vi.waitFor(() => {
      expect(wrapper.vm.outputItems).toHaveLength(2)
    })

    expect(mockResolveOutputAssetItems).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-complete' }),
      expect.any(Object)
    )
    const names = wrapper.vm.outputItems.map((i) => i.name)
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

    const wrapper = mountMultiOutput(defaultWidget(), undefined)

    await vi.waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to resolve multi-output job',
        'job-fail',
        expect.any(Error)
      )
    })

    expect(wrapper.vm.outputItems).toHaveLength(1)
    expect(wrapper.vm.outputItems[0].name).toBe('preview.png [output]')
    consoleWarnSpy.mockRestore()
  })
})

describe('WidgetSelectDropdown undo tracking', () => {
  interface UndoTrackingInstance extends ComponentPublicInstance {
    updateSelectedItems: (selectedSet: Set<string>) => void
    handleFilesUpdate: (files: File[]) => Promise<void>
  }

  const mountForUndo = (
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined
  ): VueWrapper<UndoTrackingInstance> => {
    return mount(WidgetSelectDropdown, {
      props: {
        widget,
        modelValue,
        assetKind: 'image',
        allowUpload: true,
        uploadFolder: 'input'
      },
      global: {
        plugins: [PrimeVue, createTestingPinia(), i18n]
      }
    }) as unknown as VueWrapper<UndoTrackingInstance>
  }

  beforeEach(() => {
    mockCheckState.mockClear()
  })

  it('calls checkState after dropdown selection changes modelValue', () => {
    const widget = createMockWidget<string | undefined>({
      value: 'img_001.png',
      name: 'test_image',
      type: 'combo',
      options: { values: ['img_001.png', 'photo_abc.jpg'] }
    })
    const wrapper = mountForUndo(widget, 'img_001.png')

    wrapper.vm.updateSelectedItems(new Set(['input-1']))

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['photo_abc.jpg'])
    expect(mockCheckState).toHaveBeenCalledOnce()
  })

  it('calls checkState after file upload completes', async () => {
    const { api } = await import('@/scripts/api')
    vi.mocked(api.fetchApi).mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ name: 'uploaded.png', subfolder: '' })
    } as Response)

    const widget = createMockWidget<string | undefined>({
      value: 'img_001.png',
      name: 'test_image',
      type: 'combo',
      options: { values: ['img_001.png'] }
    })
    const wrapper = mountForUndo(widget, 'img_001.png')

    const file = new File(['test'], 'uploaded.png', { type: 'image/png' })
    await wrapper.vm.handleFilesUpdate([file])

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['uploaded.png'])
    expect(mockCheckState).toHaveBeenCalledOnce()
  })
})
