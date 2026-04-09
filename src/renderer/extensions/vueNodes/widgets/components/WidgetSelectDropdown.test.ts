import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
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
})
