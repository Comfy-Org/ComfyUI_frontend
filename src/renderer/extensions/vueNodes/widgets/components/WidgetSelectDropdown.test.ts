import { getActivePinia } from 'pinia'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { fromPartial } from '@total-typescript/shoehorn'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { computed, nextTick } from 'vue'
import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@comfyorg/assets-core/schema'
import type { FormDropdownItem } from '@/renderer/extensions/vueNodes/widgets/components/form/dropdown/types'
import WidgetSelectDropdown from '@/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue'
import { useWidgetSelectActions } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'
import { api } from '@/scripts/api'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { registerTestWidget } from './widgetTestUtils'

const mockCheckState = vi.hoisted(() => vi.fn())
const mockAssetsData = vi.hoisted(() => ({ items: [] as AssetItem[] }))

vi.mock(import('@/scripts/api'))

vi.mock(import('@/platform/assets/composables/useAssetWidgetData'), () => ({
  useAssetWidgetData: () => ({
    category: computed(() => 'checkpoints'),
    assets: computed(() => mockAssetsData.items),
    isLoading: computed(() => false),
    error: computed(() => null)
  })
}))

const { mockMediaAssets } = vi.hoisted(() => {
  // oxlint-disable-next-line typescript/no-require-imports
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

vi.mock(import('@/platform/assets/adapters/outputAssetResolver'), { spy: true })

const mockUpdateSelectedItems = vi.fn()
const mockHandleFilesUpdate = vi.fn()

const { mockItemsRef, mockSelectedSetRef } = vi.hoisted(() => {
  // oxlint-disable-next-line typescript/no-require-imports
  const { ref } = require('vue')
  return {
    mockItemsRef: ref([]) as Ref<FormDropdownItem[]>,
    mockSelectedSetRef: ref(new Set()) as Ref<Set<string>>
  }
})

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectItems'),
  () => {
    // oxlint-disable-next-line typescript/no-require-imports
    const { computed } = require('vue')
    return {
      useWidgetSelectItems: () => ({
        dropdownItems: computed(() => mockItemsRef.value),
        filterOptions: computed(() => [
          { name: 'All', value: 'all' },
          { name: 'Inputs', value: 'inputs' }
        ]),
        showOwnershipFilter: computed(() => false),
        ownershipOptions: computed(() => []),
        showBaseModelFilter: computed(() => false),
        baseModelOptions: computed(() => []),
        selectedSet: computed(() => mockSelectedSetRef.value)
      })
    }
  }
)

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/composables/useWidgetSelectActions'),
  { spy: true }
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

beforeEach(() => {
  useWorkflowStore().activeWorkflow = fromPartial({
    changeTracker: { checkState: mockCheckState, captureCanvasState: vi.fn() }
  })
})

describe('WidgetSelectDropdown', () => {
  beforeEach(() => {
    vi.mocked(useWidgetSelectActions).mockReturnValue({
      updateSelectedItems: mockUpdateSelectedItems,
      handleFilesUpdate: mockHandleFilesUpdate
    })
    mockMediaAssets.media.value = []
    mockAssetsData.items = []
    mockItemsRef.value = []
    mockSelectedSetRef.value = new Set()
  })

  function renderComponent(
    widgetId: WidgetId,
    modelValue: string | undefined,
    extraProps: Record<string, unknown> = {}
  ) {
    return render(WidgetSelectDropdown, {
      props: {
        widgetId,
        modelValue,
        ...extraProps
      },
      global: {
        plugins: [getActivePinia()!, i18n]
      }
    })
  }

  it('renders the dropdown component', () => {
    mockItemsRef.value = [
      { id: 'input-0', name: 'img_001.png' },
      { id: 'input-1', name: 'photo_abc.jpg' }
    ]
    mockSelectedSetRef.value = new Set(['input-0'])
    const widget = registerTestWidget({
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

  it('allows EXR files for image uploads', async () => {
    const user = userEvent.setup()
    const file = new File(['hdr pixels'], 'environment.exr', {
      type: 'application/octet-stream'
    })
    const widget = registerTestWidget(
      {
        value: undefined,
        name: 'test_image',
        type: 'combo',
        options: { values: [] }
      },
      { spec: { type: 'COMBO', name: 'test_image', image_upload: true } }
    )
    renderComponent(widget, undefined, {
      assetKind: 'image',
      allowUpload: true
    })

    await user.upload(screen.getByLabelText('g.upload'), file)

    expect(mockHandleFilesUpdate).toHaveBeenCalledWith([file])
  })

  it('renders in cloud asset mode', () => {
    mockAssetsData.items = [
      fromPartial({
        id: 'asset-1',
        name: 'model_a.safetensors',
        preview_url: 'https://example.com/a.jpg',
        tags: []
      })
    ]
    mockItemsRef.value = [{ id: 'asset-1', name: 'model_a.safetensors' }]
    mockSelectedSetRef.value = new Set(['asset-1'])
    const widget = registerTestWidget({
      value: 'model_a.safetensors',
      name: 'test_model',
      type: 'combo',
      options: {
        values: [],
        nodeType: 'CheckpointLoaderSimple'
      }
    })
    renderComponent(widget, 'model_a.safetensors', {
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
      const widget = registerTestWidget({
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

describe('WidgetSelectDropdown upload', () => {
  it('emits the uploaded path as update:modelValue', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      fromPartial<Response>({
        status: 200,
        json: () => Promise.resolve({ name: 'uploaded.png', subfolder: '' })
      })
    )
    const widget = registerTestWidget(
      {
        value: 'existing.png',
        name: 'image',
        type: 'combo',
        options: { values: ['existing.png'] }
      },
      { spec: { type: 'COMBO', name: 'image', image_upload: true } }
    )
    const { emitted } = render(WidgetSelectDropdown, {
      props: {
        widgetId: widget,
        modelValue: 'existing.png',
        assetKind: 'image',
        allowUpload: true
      },
      global: { plugins: [getActivePinia()!, i18n] }
    })

    await userEvent
      .setup()
      .upload(
        screen.getByLabelText('g.upload'),
        new File(['png'], 'uploaded.png', { type: 'image/png' })
      )

    await vi.waitFor(() =>
      expect(emitted()['update:modelValue']).toEqual([['uploaded.png']])
    )
  })
})
