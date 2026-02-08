import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const mocks = vi.hoisted(() => ({
  shiftKey: { value: true },
  ctrlKey: { value: false },
  metaKey: { value: false },
  outputMedia: [] as AssetItem[]
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    useDebounceFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useElementHover: () => ref(false),
    useResizeObserver: () => undefined,
    useStorage: <T>(_key: string, initialValue: T) => ref(initialValue),
    useKeyModifier: (key: string) => {
      if (key === 'Shift') return mocks.shiftKey
      if (key === 'Control') return mocks.ctrlKey
      if (key === 'Meta') return mocks.metaKey
      return ref(false)
    }
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    n: (value: number) => String(value)
  }),
  createI18n: () => ({
    global: {
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key
    }
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn()
  })
}))

vi.mock('@/platform/assets/composables/media/useMediaAssets', () => ({
  useMediaAssets: (type: 'input' | 'output') => ({
    loading: ref(false),
    error: ref(null),
    media: ref(type === 'output' ? mocks.outputMedia : []),
    fetchMediaList: vi.fn(async () => {}),
    hasMore: ref(false),
    isLoadingMore: ref(false),
    loadMore: vi.fn(async () => {})
  })
}))

vi.mock('@/platform/assets/composables/useMediaAssetFiltering', () => ({
  useMediaAssetFiltering: (baseAssets: { value: AssetItem[] }) => ({
    searchQuery: ref(''),
    sortBy: ref('newest'),
    mediaTypeFilters: ref([]),
    filteredAssets: computed(() => baseAssets.value)
  })
}))

vi.mock('@/platform/assets/composables/useOutputStacks', () => ({
  useOutputStacks: ({ assets }: { assets: { value: AssetItem[] } }) => ({
    assetItems: computed(() =>
      assets.value.map((asset) => ({ key: asset.id, asset }))
    ),
    selectableAssets: computed(() => assets.value),
    isStackExpanded: () => false,
    toggleStack: vi.fn(async () => {})
  })
}))

vi.mock('@/platform/assets/composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({
    downloadMultipleAssets: vi.fn(),
    deleteAssets: vi.fn(async () => true),
    addMultipleToWorkflow: vi.fn(async () => {}),
    openMultipleWorkflows: vi.fn(async () => {}),
    exportMultipleWorkflows: vi.fn(async () => {})
  })
}))

vi.mock('@/platform/assets/composables/media/assetMappers', () => ({
  getAssetType: (tags: unknown) =>
    Array.isArray(tags) && tags.includes('output') ? 'output' : 'input'
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => false
  })
}))

vi.mock('@/stores/queueStore', () => {
  class ResultItemImpl {
    filename: string
    subfolder: string
    type: string
    nodeId: string
    mediaType: string

    constructor({
      filename,
      subfolder,
      type,
      nodeId,
      mediaType
    }: {
      filename: string
      subfolder: string
      type: string
      nodeId: string
      mediaType: string
    }) {
      this.filename = filename
      this.subfolder = subfolder
      this.type = type
      this.nodeId = nodeId
      this.mediaType = mediaType
    }
  }

  return {
    useQueueStore: () => ({
      activeJobsCount: ref(0),
      pendingTasks: []
    }),
    ResultItemImpl
  }
})

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn(async () => {})
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: vi.fn()
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    clearInitializationByPromptIds: vi.fn()
  })
}))

vi.mock('@/utils/formatUtil', () => ({
  formatDuration: (duration: number) => `${duration}ms`,
  getMediaTypeFromFilename: () => 'image'
}))

vi.mock('@/utils/tailwindUtil', () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ')
}))

vi.mock('@/platform/assets/utils/outputAssetUtil', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    resolveOutputAssetItems: vi.fn(async () => [])
  }
})

import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'

const sidebarTabTemplateStub = {
  template: `
    <div>
      <slot name="alt-title" />
      <slot name="tool-buttons" />
      <slot name="header" />
      <slot name="body" />
      <slot name="footer" />
    </div>
  `
}

const buttonStub = {
  template: '<button @click="$emit(\'click\', $event)"><slot /></button>'
}

const assetsSidebarGridViewStub = {
  props: {
    assets: {
      type: Array,
      required: true
    }
  },
  template: `
    <div>
      <button
        v-for="asset in assets"
        :key="asset.id"
        :data-testid="'asset-' + asset.id"
        @click.stop="$emit('select-asset', asset, assets)"
      >
        {{ asset.name }}
      </button>
    </div>
  `
}

function createAsset(
  id: string,
  name: string,
  userMetadata?: Record<string, unknown>
): AssetItem {
  return {
    id,
    name,
    tags: ['output'],
    user_metadata: userMetadata
  }
}

describe('AssetsSidebarTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.shiftKey.value = true
    mocks.ctrlKey.value = false
    mocks.metaKey.value = false
    mocks.outputMedia = []
  })

  it('shows deduplicated selected count for parent stack and selected children', async () => {
    const outputs = [
      {
        filename: 'parent.png',
        nodeId: '1',
        subfolder: 'outputs',
        url: 'https://example.com/parent.png'
      }
    ]

    const parent = createAsset('parent', 'parent.png', {
      promptId: 'prompt-1',
      nodeId: '1',
      subfolder: 'outputs',
      outputCount: 4,
      allOutputs: outputs
    })
    const child1 = createAsset('child-1', 'child-1.png', {
      promptId: 'prompt-1',
      nodeId: '2',
      subfolder: 'outputs'
    })
    const child2 = createAsset('child-2', 'child-2.png', {
      promptId: 'prompt-1',
      nodeId: '3',
      subfolder: 'outputs'
    })
    const child3 = createAsset('child-3', 'child-3.png', {
      promptId: 'prompt-1',
      nodeId: '4',
      subfolder: 'outputs'
    })

    mocks.outputMedia = [parent, child1, child2, child3]

    const wrapper = mount(AssetsSidebarTab, {
      global: {
        stubs: {
          SidebarTabTemplate: sidebarTabTemplateStub,
          Button: buttonStub,
          TabList: true,
          Tab: true,
          Divider: true,
          ProgressSpinner: true,
          NoResultsPlaceholder: true,
          MediaAssetFilterBar: true,
          AssetsSidebarListView: true,
          AssetsSidebarGridView: assetsSidebarGridViewStub,
          ResultGallery: true,
          MediaAssetContextMenu: true
        },
        mocks: {
          $t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}:${JSON.stringify(params)}` : key
        }
      }
    })

    await wrapper.find('[data-testid="asset-parent"]').trigger('click')
    await wrapper.find('[data-testid="asset-child-3"]').trigger('click')

    await flushPromises()

    expect(wrapper.text()).toContain(
      'mediaAsset.selection.selectedCount:{"count":4}'
    )
    expect(wrapper.text()).not.toContain(
      'mediaAsset.selection.selectedCount:{"count":7}'
    )
  })
})
