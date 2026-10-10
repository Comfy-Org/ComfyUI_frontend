import userEvent from '@testing-library/user-event'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { resolveOutputAssetItems } from '@/platform/assets/utils/outputAssetUtil'
import { useAssetsStore } from '@/stores/assetsStore'

import AssetsSidebarTab from './AssetsSidebarTab.vue'

beforeEach(() => {
  const store = useAssetsStore()
  store.outputAssets = {
    items: [],
    hasMore: false,
    isLoading: false,
    loadMore: vi.fn(async () => false),
    loadNew: vi.fn(async () => {}),
    invalidate: vi.fn(async () => {})
  }
  vi.spyOn(store.inputAssets, 'loadNew').mockResolvedValue(undefined)
  vi.spyOn(store.inputAssets, 'loadMore').mockResolvedValue(false)
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

vi.mock(import('@/platform/assets/composables/useMediaAssetActions'))

vi.mock(import('@/platform/assets/utils/outputAssetUtil'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      assetBrowser: { jobId: 'Job ID' },
      g: { copyJobId: 'Copy Job ID' },
      sideToolbar: {
        backToAssets: 'Back to all assets',
        closeSidebar: 'Close sidebar',
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
  emits: ['output-count-click', 'context-menu'],
  template: `
    <div data-testid="assets-grid">
      <button
        aria-label="Enter output folder"
        @click="$emit('output-count-click', assets[0])"
        @contextmenu.prevent="$emit('context-menu', $event, assets[0])"
      />
    </div>
  `
}

function renderTab({ realTemplate = false } = {}) {
  return render(AssetsSidebarTab, {
    global: {
      plugins: [i18n],
      directives: {
        tooltip: {}
      },
      stubs: {
        ...(realTemplate ? {} : { SidebarTabTemplate: sidebarTabTemplateStub }),
        AssetsSidebarGridView: assetsGridStub,
        AssetsSidebarListView: true,
        MediaAssetFilterBar: true,
        MediaAssetSelectionBar: true,
        MediaLightbox: true
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

describe('AssetsSidebarTab reopen', () => {
  it('keeps a cached list on screen and only fetches newer items', () => {
    const outputAssets = useAssetsStore().outputAssets
    outputAssets.isLoading = true

    renderTab()

    expect(outputAssets.loadNew).toHaveBeenCalledOnce()
    expect(outputAssets.invalidate).not.toHaveBeenCalled()
    expect(screen.getByTestId('assets-grid')).toBeVisible()
  })

  it('loads the first page when nothing is cached', () => {
    const outputAssets = useAssetsStore().outputAssets
    outputAssets.items = []

    renderTab()

    expect(outputAssets.invalidate).toHaveBeenCalledOnce()
    expect(outputAssets.loadNew).not.toHaveBeenCalled()
  })
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

it('shows the sidebar close button when mounted as a sidebar tab', () => {
  renderTab({ realTemplate: true })

  expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeVisible()
})

describe('AssetsSidebarTab context menu', () => {
  it('inserts a loadable image as a node', async () => {
    const asset = { ...folderAsset, name: 'image.png' }
    useAssetsStore().outputAssets.items = [asset]
    renderTab()

    await fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Enter output folder' })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: 'mediaAsset.actions.insertAsNodeInWorkflow'
      })
    )

    expect(useMediaAssetActions().addWorkflow).toHaveBeenCalledWith(asset)
  })

  it('does not offer insertion for an unloadable file', async () => {
    useAssetsStore().outputAssets.items = [
      { ...folderAsset, name: 'result.txt' }
    ]
    renderTab()

    await fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Enter output folder' })
    )
    await screen.findByRole('menu')

    expect(
      screen.queryByRole('menuitem', {
        name: 'mediaAsset.actions.insertAsNodeInWorkflow'
      })
    ).not.toBeInTheDocument()
  })

  it('downloads grouped outputs through the multi-asset download action', async () => {
    renderTab()
    await fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Enter output folder' })
    )

    await userEvent.click(
      await screen.findByRole('menuitem', {
        name: 'mediaAsset.actions.download'
      })
    )

    expect(useMediaAssetActions().downloadAssets).toHaveBeenCalledWith([
      folderAsset
    ])
  })

  it.for(['pointerDown', 'scroll'] as const)(
    'dismisses on outside %s',
    async (event) => {
      renderTab()
      await fireEvent.contextMenu(
        screen.getByRole('button', { name: 'Enter output folder' })
      )
      await screen.findByRole('menu')

      await fireEvent[event](
        screen.getByRole('heading', { name: 'Media Assets' })
      )

      await waitFor(() =>
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      )
    }
  )
})

describe('AssetsSidebarTab tab panel', () => {
  it('labels the asset list with the selected tab', async () => {
    renderTab()

    expect(
      screen.getByRole('tabpanel', { name: 'Generated' })
    ).toContainElement(screen.getByTestId('assets-grid'))

    await userEvent.click(screen.getByRole('tab', { name: 'Imported' }))

    expect(screen.getByRole('tabpanel', { name: 'Imported' })).toBeVisible()
  })

  it('keeps the panel in the tab order', () => {
    renderTab()

    expect(screen.getByRole('tabpanel', { name: 'Generated' })).toHaveAttribute(
      'tabindex',
      '0'
    )
  })
})
