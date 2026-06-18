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
const mockAssetDataRefresh = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)

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
      error: computed(() => null),
      refresh: mockAssetDataRefresh
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

vi.mock('@/platform/assets/composables/media/useAssetsApi', () => ({
  useAssetsApi: () => mockMediaAssets
}))

vi.mock('@/platform/assets/utils/outputAssetUtil', () => ({
  resolveOutputAssetItems: vi.fn().mockResolvedValue([])
}))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdown.vue',
  () => ({
    default: {
      name: 'FormDropdownStub',
      props: ['items', 'displayItems', 'selected', 'placeholder'],
      emits: ['update:is-open', 'update:selected', 'update:files'],
      template: `
        <div>
          <button type="button" data-testid="fd-open" @click="$emit('update:is-open', true)">open</button>
          <button type="button" data-testid="fd-close" @click="$emit('update:is-open', false)">close</button>
          <span v-for="item in (displayItems || items || [])" :key="item.id">
            <span v-if="(selected || new Set()).has(item.id)">{{ item.name }}</span>
          </span>
        </div>
      `
    }
  })
)

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
    mockMediaAssets.refresh.mockClear()
    mockAssetDataRefresh.mockClear()
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

  describe('handleIsOpenUpdate', () => {
    function renderAssetMode() {
      const widget = createMockWidget<string | undefined>({
        value: 'model_a.safetensors',
        name: 'ckpt_name',
        type: 'combo',
        options: { values: [], nodeType: 'CheckpointLoaderSimple' }
      })
      return renderComponent(widget, 'model_a.safetensors', {
        assetKind: 'model',
        isAssetMode: true,
        nodeType: 'CheckpointLoaderSimple'
      })
    }

    function renderNonAssetMode() {
      const widget = createMockWidget<string | undefined>({
        value: 'cat.png',
        name: 'image',
        type: 'combo',
        options: { values: ['cat.png', 'dog.png'] }
      })
      return renderComponent(widget, 'cat.png')
    }

    async function fireOpen() {
      const { default: userEvent } = await import('@testing-library/user-event')
      const user = userEvent.setup()
      await user.click(screen.getByTestId('fd-open'))
    }

    async function fireClose() {
      const { default: userEvent } = await import('@testing-library/user-event')
      const user = userEvent.setup()
      await user.click(screen.getByTestId('fd-close'))
    }

    it('skips outputMediaAssets refresh and triggers assetData refresh when asset-mode dropdown opens', async () => {
      renderAssetMode()
      await fireOpen()
      expect(mockMediaAssets.refresh).not.toHaveBeenCalled()
      expect(mockAssetDataRefresh).toHaveBeenCalledTimes(1)
    })

    it('refetches model assets on every asset-mode dropdown reopen (no stale cache)', async () => {
      renderAssetMode()
      await fireOpen()
      await fireClose()
      await fireOpen()
      expect(mockAssetDataRefresh).toHaveBeenCalledTimes(2)
      expect(mockMediaAssets.refresh).not.toHaveBeenCalled()
    })

    it('refreshes outputMediaAssets when non-asset-mode dropdown opens (preserved behavior)', async () => {
      renderNonAssetMode()
      await fireOpen()
      expect(mockMediaAssets.refresh).toHaveBeenCalledTimes(1)
      expect(mockAssetDataRefresh).not.toHaveBeenCalled()
    })

    it('does nothing when the dropdown is closed', async () => {
      renderNonAssetMode()
      await fireClose()
      expect(mockMediaAssets.refresh).not.toHaveBeenCalled()
      expect(mockAssetDataRefresh).not.toHaveBeenCalled()
    })
  })
})
