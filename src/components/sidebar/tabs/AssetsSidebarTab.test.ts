import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'

import AssetsSidebarTab from './AssetsSidebarTab.vue'

const mockGetServerFeature = vi.spyOn(api, 'getServerFeature')

const flatOutputMocks = vi.hoisted(() => ({
  media: undefined as unknown as Ref<AssetItem[]>,
  hasMore: undefined as unknown as Ref<boolean>,
  loadMore: vi.fn()
}))

const folderAsset = vi.hoisted(
  () =>
    ({
      id: 'multi-output',
      name: 'multi-output.png',
      tags: ['output'],
      user_metadata: {
        jobId: 'multi-output-job',
        nodeId: '1',
        subfolder: '',
        outputCount: 2
      }
    }) satisfies AssetItem
)

const videoAsset = vi.hoisted(
  () =>
    ({
      id: 'video-output',
      name: 'video-output.mp4',
      mime_type: 'video/mp4',
      tags: ['output']
    }) satisfies AssetItem
)

vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))

vi.mock('@/platform/assets/composables/media/useAssetsApi', async () => {
  const { ref } = await import('vue')

  return {
    useAssetsApi: () => ({
      media: ref([folderAsset]),
      loading: ref(false),
      error: ref(null),
      fetchMediaList: vi.fn(async () => [folderAsset]),
      loadMore: vi.fn(),
      hasMore: ref(false),
      isLoadingMore: ref(false)
    })
  }
})

vi.mock('@/platform/assets/composables/media/useFlatOutputAssets', async () => {
  const { ref } = await import('vue')
  flatOutputMocks.media = ref([folderAsset, videoAsset])
  flatOutputMocks.hasMore = ref(false)

  return {
    useFlatOutputAssets: () => ({
      media: flatOutputMocks.media,
      loading: ref(false),
      error: ref(null),
      fetchMediaList: vi.fn().mockResolvedValue(flatOutputMocks.media.value),
      loadMore: flatOutputMocks.loadMore,
      hasMore: flatOutputMocks.hasMore,
      isLoadingMore: ref(false)
    })
  }
})

vi.mock('@/platform/assets/composables/useAssetGridSelection', async () => {
  const { ref } = await import('vue')
  return {
    useAssetGridSelection: () => ({ marqueeStyle: ref(null) })
  }
})

vi.mock('@/platform/assets/composables/useAssetSelection', async () => {
  const { ref } = await import('vue')

  return {
    useAssetSelection: () => ({
      isSelected: vi.fn(() => false),
      selectedIds: ref(new Set<string>()),
      handleAssetClick: vi.fn(),
      selectAll: vi.fn(),
      setSelectedIds: vi.fn(),
      hasSelection: ref(false),
      clearSelection: vi.fn(),
      getSelectedAssets: vi.fn(() => []),
      reconcileSelection: vi.fn(),
      getOutputCount: vi.fn(() => 2),
      getTotalOutputCount: vi.fn(() => 0),
      activate: vi.fn(),
      deactivate: vi.fn()
    })
  }
})

vi.mock('@/platform/assets/composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({
    downloadAssets: vi.fn(),
    deleteAssets: vi.fn(),
    addMultipleToWorkflow: vi.fn(),
    openMultipleWorkflows: vi.fn(),
    exportMultipleWorkflows: vi.fn()
  })
}))

vi.mock('@/platform/assets/utils/outputAssetUtil', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveOutputAssetItems: vi.fn(async () => [folderAsset])
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      assetBrowser: { jobId: 'Job ID' },
      g: { copyJobId: 'Copy Job ID' },
      sideToolbar: {
        backToAssets: 'Back to all assets',
        mediaAssets: { title: 'Media Assets' },
        labels: { generated: 'Generated', imported: 'Imported' }
      },
      mediaAsset: {
        generatedMediaTabs: {
          all: 'All',
          images: 'Images',
          videos: 'Videos',
          audio: 'Audio'
        }
      }
    }
  }
})

const sidebarTabTemplateStub = {
  props: ['title'],
  template: `
    <section>
      <h2 v-if="title">{{ title }}</h2>
      <div data-testid="folder-title"><slot name="alt-title" /></div>
      <div data-testid="folder-controls"><slot name="header" /></div>
      <slot name="body" />
    </section>
  `
}

const assetsGridStub = {
  props: ['assets'],
  emits: ['output-count-click'],
  template: `
    <button
      v-if="assets.length"
      aria-label="Enter output folder"
      @click="$emit('output-count-click', assets[0])"
    />
    <span v-for="asset in assets" :key="asset.id">{{ asset.name }}</span>
  `
}

const buttonStub = {
  template: '<button><slot /></button>'
}

function renderTab() {
  return render(AssetsSidebarTab, {
    global: {
      plugins: [createPinia(), i18n],
      directives: {
        tooltip: {}
      },
      stubs: {
        SidebarTabTemplate: sidebarTabTemplateStub,
        AssetsSidebarGridView: assetsGridStub,
        AssetsSidebarListView: true,
        Button: buttonStub,
        MediaAssetFilterBar: true,
        MediaAssetSelectionBar: true,
        MediaLightbox: true,
        MediaAssetContextMenu: true,
        NoResultsPlaceholder: true,
        Skeleton: true
      }
    }
  })
}

describe('AssetsSidebarTab folder navigation', () => {
  beforeEach(() => {
    mockGetServerFeature.mockReturnValue(true)
    flatOutputMocks.media.value = [folderAsset, videoAsset]
    flatOutputMocks.hasMore.value = false
    flatOutputMocks.loadMore.mockReset()
  })

  it('places accessible folder actions beside the job ID', async () => {
    renderTab()
    await userEvent.click(
      screen.getByRole('button', { name: 'Enter output folder' })
    )

    const folderTitle = screen.getByTestId('folder-title')
    const backButton = within(folderTitle).getByRole('button', {
      name: 'Back to all assets'
    })
    within(folderTitle).getByRole('button', {
      name: 'Copy Job ID'
    })
    const jobId = within(folderTitle).getByText('multi-output-job')

    expect(backButton).not.toHaveTextContent(/\S/)
    expect(jobId).toBeVisible()
    expect(screen.getByTestId('folder-controls')).not.toHaveTextContent(
      'Back to all assets'
    )

    await userEvent.click(backButton)
    expect(screen.getByText('Media Assets')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Back to all assets' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('multi-output-job')).not.toBeInTheDocument()
  })

  it('filters persisted generated assets by media type', async () => {
    renderTab()

    expect(screen.getByText('multi-output.png')).toBeVisible()
    expect(screen.getByText('video-output.mp4')).toBeVisible()

    await userEvent.click(screen.getByText('Videos'))
    await nextTick()

    expect(screen.queryByText('multi-output.png')).not.toBeInTheDocument()
    expect(screen.getByText('video-output.mp4')).toBeVisible()
  })

  it('loads more persisted assets when the selected media type is absent', async () => {
    flatOutputMocks.media.value = [folderAsset]
    flatOutputMocks.hasMore.value = true
    flatOutputMocks.loadMore.mockImplementation(async () => {
      flatOutputMocks.media.value = [folderAsset, videoAsset]
      flatOutputMocks.hasMore.value = false
    })
    renderTab()

    await userEvent.click(screen.getByText('Videos'))
    await nextTick()

    expect(flatOutputMocks.loadMore).toHaveBeenCalledOnce()
    expect(screen.getByText('video-output.mp4')).toBeVisible()
  })

  it('keeps history-backed generated assets when the asset API is disabled', () => {
    mockGetServerFeature.mockReturnValue(false)

    renderTab()

    expect(screen.getByText('multi-output.png')).toBeVisible()
    expect(screen.queryByText('video-output.mp4')).not.toBeInTheDocument()
  })
})
