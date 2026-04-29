import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { computed, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetSelectDropdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
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

const { mockMediaAssets } = vi.hoisted(() => {
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
    }
  }
})

vi.mock('@/platform/assets/composables/media/useMediaAssets', () => ({
  useMediaAssets: () => mockMediaAssets
}))

vi.mock('@/platform/assets/utils/outputAssetUtil', () => ({
  resolveOutputAssetItems: vi.fn().mockResolvedValue([])
}))

const mockUpdateSelectedItems = vi.hoisted(() => vi.fn())
const mockHandleFilesUpdate = vi.hoisted(() => vi.fn())

const { mockItemsRef, mockSelectedSetRef, mockFilterSelectedRef } = vi.hoisted(
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ref } = require('vue')
    return {
      mockItemsRef: ref([]) as Ref<FormDropdownItem[]>,
      mockSelectedSetRef: ref(new Set()) as Ref<Set<string>>,
      mockFilterSelectedRef: ref('all') as Ref<string>
    }
  }
)

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { computed } = require('vue')
    return {
      useWidgetSelectItems: () => ({
        dropdownItems: computed(() => mockItemsRef.value),
        displayItems: computed(() => mockItemsRef.value),
        filterSelected: mockFilterSelectedRef,
        filterOptions: computed(() => [
          { name: 'All', value: 'all' },
          { name: 'Inputs', value: 'inputs' }
        ]),
        ownershipSelected: ref('all'),
        showOwnershipFilter: computed(() => false),
        ownershipOptions: computed(() => []),
        baseModelSelected: ref(new Set<string>()),
        showBaseModelFilter: computed(() => false),
        baseModelOptions: computed(() => []),
        selectedSet: computed(() => mockSelectedSetRef.value)
      })
    }
  }
)

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions',
  () => ({
    useWidgetSelectActions: () => ({
      updateSelectedItems: mockUpdateSelectedItems,
      handleFilesUpdate: mockHandleFilesUpdate
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

describe('WidgetSelectDropdown', () => {
  beforeEach(() => {
    mockMediaAssets.media.value = []
    mockCheckState.mockClear()
    mockAssetsData.items = []
    mockItemsRef.value = []
    mockSelectedSetRef.value = new Set()
    mockFilterSelectedRef.value = 'all'
    mockUpdateSelectedItems.mockClear()
    mockHandleFilesUpdate.mockClear()
  })

  function renderComponent(
    widget: SimplifiedWidget<string | undefined>,
    modelValue: string | undefined,
    extraProps: Record<string, unknown> = {}
  ) {
    return render(WidgetSelectDropdown, {
      props: {
        widget,
        modelValue,
        assetKind: 'image',
        allowUpload: true,
        uploadFolder: 'input',
        ...extraProps
      },
      global: {
        plugins: [PrimeVue, createTestingPinia(), i18n]
      }
    })
  }

  it('renders the dropdown component', () => {
    mockItemsRef.value = [
      { id: 'input-0', name: 'img_001.png' },
      { id: 'input-1', name: 'photo_abc.jpg' }
    ]
    mockSelectedSetRef.value = new Set(['input-0'])
    const widget = createMockWidget<string | undefined>({
      value: 'img_001.png',
      name: 'test_image',
      type: 'combo',
      options: {
        values: ['img_001.png', 'photo_abc.jpg']
      }
    })
    renderComponent(widget, 'img_001.png')
    expect(screen.getByText('img_001.png')).toBeDefined()
  })

  it('renders in cloud asset mode', () => {
    mockAssetsData.items = [
      {
        id: 'asset-1',
        name: 'model_a.safetensors',
        preview_url: 'https://example.com/a.jpg',
        tags: []
      }
    ]
    mockItemsRef.value = [{ id: 'asset-1', name: 'model_a.safetensors' }]
    mockSelectedSetRef.value = new Set(['asset-1'])
    const widget = createMockWidget<string | undefined>({
      value: 'model_a.safetensors',
      name: 'test_model',
      type: 'combo',
      options: {
        values: [],
        nodeType: 'CheckpointLoaderSimple'
      }
    })
    renderComponent(widget, 'model_a.safetensors', {
      assetKind: 'model',
      isAssetMode: true,
      nodeType: 'CheckpointLoaderSimple'
    })
    expect(screen.getByText('model_a.safetensors')).toBeDefined()
  })

  describe('composable wiring', () => {
    const items: FormDropdownItem[] = [
      { id: 'input-0', name: 'cat.png', label: 'cat.png' },
      { id: 'input-1', name: 'dog.png', label: 'dog.png' }
    ]

    function renderDefault() {
      mockItemsRef.value = items
      const widget = createMockWidget<string | undefined>({
        value: 'cat.png',
        name: 'test_image',
        type: 'combo',
        options: { values: ['cat.png', 'dog.png'] }
      })
      return renderComponent(widget, 'cat.png')
    }

    it('displays the item whose id is in selectedSet', async () => {
      mockSelectedSetRef.value = new Set(['input-1'])
      renderDefault()

      expect(screen.getByText('dog.png')).toBeDefined()
      expect(screen.queryByText('cat.png')).toBeNull()
    })

    it('shows placeholder when selectedSet is empty', () => {
      mockSelectedSetRef.value = new Set()
      renderDefault()

      expect(screen.queryByText('cat.png')).toBeNull()
      expect(screen.queryByText('dog.png')).toBeNull()
    })

    it('updates displayed selection when selectedSet changes', async () => {
      mockSelectedSetRef.value = new Set(['input-0'])
      renderDefault()
      expect(screen.getByText('cat.png')).toBeDefined()

      mockSelectedSetRef.value = new Set(['input-1'])
      await nextTick()

      expect(screen.getByText('dog.png')).toBeDefined()
      expect(screen.queryByText('cat.png')).toBeNull()
    })
  })
})
