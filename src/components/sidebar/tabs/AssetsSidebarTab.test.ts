import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { useAssetsStore } from '@/stores/assetsStore'

import AssetsSidebarTab from './AssetsSidebarTab.vue'

beforeEach(() => {
  const store = useAssetsStore()
  store.outputAssets = {
    items: [],
    hasMore: false,
    isLoading: false,
    loadMore: vi.fn(async () => {}),
    loadNew: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {})
  }
  vi.spyOn(store.inputAssets, 'loadNew').mockResolvedValue(undefined)
  vi.spyOn(store.inputAssets, 'loadMore').mockResolvedValue(undefined)
})

const folderAsset = vi.hoisted(() => ({
  id: 'multi-output',
  name: 'multi-output.png',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  tags: ['output'],
  user_metadata: {
    jobId: 'multi-output-job',
    nodeId: '1',
    subfolder: '',
    outputCount: 2
  }
}))

vi.mock<unknown>(
  import('@/platform/assets/composables/useAssetGridSelection'),
  async () => {
    const { ref } = await import('vue')
    return {
      useAssetGridSelection: () => ({ marqueeStyle: ref(null) })
    }
  }
)

vi.mock<unknown>(
  import('@/platform/assets/composables/useAssetSelection'),
  async () => {
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
  }
)

vi.mock<unknown>(
  import('@/platform/assets/composables/useMediaAssetActions'),
  () => ({
    useMediaAssetActions: () => ({
      downloadAssets: vi.fn(),
      deleteAssets: vi.fn(),
      addMultipleToWorkflow: vi.fn(),
      openMultipleWorkflows: vi.fn(),
      exportMultipleWorkflows: vi.fn()
    })
  })
)

vi.mock<unknown>(import('@/platform/assets/utils/outputAssetUtil'))

vi.mock<unknown>(
  import('primevue/usetoast'), // eslint-disable-line primevue-removal/no-imports
  () => ({
    useToast: () => ({ add: vi.fn() })
  })
)

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
    <div data-testid="assets-grid">
      <button
        aria-label="Enter output folder"
        @click="$emit('output-count-click', assets[0])"
      />
    </div>
  `
}

const buttonStub = {
  template: '<button><slot /></button>'
}

function renderTab() {
  return render(AssetsSidebarTab, {
    global: {
      plugins: [i18n],
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

beforeEach(() => {
  useAssetsStore().outputAssets.items = [folderAsset]
  useAssetsStore().outputAssets.hasMore = false
})

it('keeps pagination mounted when more assets can be loaded', () => {
  useAssetsStore().outputAssets.items = []
  useAssetsStore().outputAssets.hasMore = true

  renderTab()

  expect(screen.getByTestId('assets-grid')).toBeVisible()
})

describe('AssetsSidebarTab folder navigation', () => {
  it('places accessible folder actions beside the job ID', async () => {
    vi.mocked(resolveOutputAssetItems).mockResolvedValue([folderAsset])
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
})
