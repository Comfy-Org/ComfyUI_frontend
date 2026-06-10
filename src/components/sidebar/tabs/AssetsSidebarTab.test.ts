import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import AssetsSidebarTab from './AssetsSidebarTab.vue'

const mockDownloadAssets = vi.hoisted(() => vi.fn())

const outputAsset: AssetItem = {
  id: 'out-1',
  name: 'render.png',
  size: 1024,
  created_at: '2025-01-01T00:00:00Z',
  tags: ['output']
}

function createAssetsApi() {
  return {
    media: ref<AssetItem[]>([outputAsset]),
    loading: ref(false),
    error: ref(null),
    fetchMediaList: vi.fn(),
    refresh: vi.fn(),
    loadMore: vi.fn(),
    hasMore: ref(false),
    isLoadingMore: ref(false)
  }
}

vi.mock('@/platform/assets/composables/media/useAssetsApi', () => ({
  useAssetsApi: () => createAssetsApi()
}))

vi.mock('@/platform/assets/composables/useMediaAssetFiltering', () => ({
  useMediaAssetFiltering: (assets: { value: AssetItem[] }) => ({
    searchQuery: ref(''),
    sortBy: ref('newest'),
    mediaTypeFilters: ref([]),
    filteredAssets: computed(() => assets.value)
  })
}))

vi.mock('@/platform/assets/composables/useOutputStacks', () => ({
  useOutputStacks: () => ({
    assetItems: ref([]),
    selectableAssets: ref([]),
    isStackExpanded: () => false,
    toggleStack: vi.fn()
  })
}))

vi.mock('@/platform/assets/composables/useAssetSelection', () => ({
  useAssetSelection: () => ({
    isSelected: () => false,
    handleAssetClick: vi.fn(),
    hasSelection: ref(true),
    clearSelection: vi.fn(),
    getSelectedAssets: (assets: AssetItem[]) => assets,
    reconcileSelection: vi.fn(),
    getOutputCount: () => 1,
    getTotalOutputCount: () => 1,
    activate: vi.fn(),
    deactivate: vi.fn()
  })
}))

vi.mock('@/platform/assets/composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({
    downloadAssets: mockDownloadAssets,
    deleteAssets: vi.fn().mockResolvedValue(false),
    addMultipleToWorkflow: vi.fn(),
    openMultipleWorkflows: vi.fn(),
    exportMultipleWorkflows: vi.fn()
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      sideToolbar: {
        mediaAssets: { title: 'Media Assets' },
        backToAssets: 'Back to all assets',
        labels: { generated: 'Generated', imported: 'Imported' },
        noImportedFiles: 'No imported files',
        noGeneratedFiles: 'No generated files',
        noFilesFoundMessage: 'No files found'
      },
      assetBrowser: { jobId: 'Job ID' },
      mediaAsset: {
        selection: {
          includePreviews: 'Download previews',
          downloadSelected: 'Download',
          deleteSelected: 'Delete',
          deselectAll: 'Deselect all',
          selectedCount: '{count} selected'
        }
      }
    }
  }
})

function renderTab() {
  return render(AssetsSidebarTab, {
    global: {
      plugins: [createTestingPinia({ stubActions: false }), i18n],
      directives: { tooltip: () => {} },
      stubs: {
        SidebarTabTemplate: {
          template:
            '<div><slot name="alt-title" /><slot name="header" /><slot name="body" /><slot name="footer" /></div>'
        },
        MediaAssetFilterBar: true,
        AssetsSidebarGridView: true,
        AssetsSidebarListView: true,
        MediaAssetContextMenu: true,
        MediaLightbox: true,
        NoResultsPlaceholder: true,
        Skeleton: true,
        ToggleSwitch: {
          props: { modelValue: { type: Boolean, default: false } },
          emits: ['update:modelValue'],
          template:
            '<button type="button" role="switch" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />'
        }
      }
    }
  })
}

const includePreviewsToggle = () =>
  screen.queryByTestId('assets-include-previews')

describe('AssetsSidebarTab include-previews toggle', () => {
  beforeEach(() => {
    mockDownloadAssets.mockClear()
  })

  it('shows the toggle on the generated (output) tab and hides it on imported', async () => {
    const user = userEvent.setup()
    renderTab()

    expect(includePreviewsToggle()).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Imported' }))

    expect(includePreviewsToggle()).not.toBeInTheDocument()
  })

  it('downloads without previews by default', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(screen.getByTestId('assets-download-selected'))

    expect(mockDownloadAssets).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'out-1' })],
      false
    )
  })

  it('forwards include-previews when the toggle is enabled before download', async () => {
    const user = userEvent.setup()
    renderTab()

    const toggle = includePreviewsToggle()!
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByTestId('assets-download-selected'))

    expect(mockDownloadAssets).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'out-1' })],
      true
    )
  })

  it('does not forward a stale toggle after switching away from the output tab', async () => {
    const user = userEvent.setup()
    renderTab()

    await user.click(includePreviewsToggle()!)
    await user.click(screen.getByRole('tab', { name: 'Imported' }))
    await user.click(screen.getByTestId('assets-download-selected'))

    expect(mockDownloadAssets).toHaveBeenCalledWith(expect.anything(), false)
  })
})
