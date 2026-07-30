import { createTestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import AssetsSidebarTab from './AssetsSidebarTab.vue'

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

const folderAssets = vi.hoisted(
  () =>
    [
      {
        id: 'multi-output-1--multi-output-a.png',
        name: 'multi-output-a.png',
        tags: ['output'],
        user_metadata: {
          jobId: 'multi-output-job',
          nodeId: '1',
          subfolder: ''
        }
      },
      {
        id: 'multi-output-1--multi-output-b.png',
        name: 'multi-output-b.png',
        tags: ['output'],
        user_metadata: {
          jobId: 'multi-output-job',
          nodeId: '1',
          subfolder: ''
        }
      }
    ] satisfies AssetItem[]
)

vi.mock('@/platform/assets/composables/media/useAssetsApi', async () => {
  const { ref } = await import('vue')

  return {
    useAssetsApi: () => ({
      media: ref([folderAsset]),
      loading: ref(false),
      error: ref(null),
      fetchMediaList: vi.fn().mockResolvedValue([folderAsset]),
      loadMore: vi.fn(),
      hasMore: ref(false),
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
  resolveOutputAssetItems: vi.fn().mockResolvedValue(folderAssets)
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
      <slot name="footer" />
    </section>
  `
}

const assetsGridStub = {
  props: [
    'assets',
    'isSelected',
    'isPartiallySelected',
    'showOutputCount',
    'getOutputCount',
    'getSelectedOutputCount'
  ],
  emits: ['output-count-click', 'select-asset'],
  template: `
    <div v-for="asset in assets" :key="asset.id">
      <button
        :aria-label="'Select ' + asset.name"
        :aria-pressed="
          isSelected(asset.id)
            ? 'true'
            : isPartiallySelected?.(asset)
              ? 'mixed'
              : 'false'
        "
        @click.stop="$emit('select-asset', asset)"
      />
      <button
        v-if="showOutputCount(asset)"
        aria-label="Enter output folder"
        @click.stop="$emit('output-count-click', asset)"
      >
        <template
          v-if="
            getSelectedOutputCount?.(asset) > 0 &&
            getSelectedOutputCount(asset) < getOutputCount(asset)
          "
        >
          {{ getSelectedOutputCount(asset) }}/{{ getOutputCount(asset) }}
        </template>
        <template v-else>{{ getOutputCount(asset) }}</template>
      </button>
    </div>
  `
}

const assetsListStub = {
  props: [
    'assetItems',
    'selectableAssets',
    'isSelected',
    'isPartiallySelected',
    'getSelectedOutputCount',
    'toggleStack'
  ],
  emits: ['select-asset'],
  template: `
    <button
      v-if="assetItems.length"
      aria-label="Expand list group"
      @click.stop="toggleStack(assetItems[0].asset)"
    />
    <button
      v-for="item in assetItems"
      :key="item.key"
      :aria-label="'List select ' + item.asset.name"
      :aria-pressed="
        isSelected(item.asset)
          ? 'true'
          : isPartiallySelected(item.asset)
            ? 'mixed'
            : 'false'
      "
      @click.stop="$emit('select-asset', item.asset, selectableAssets)"
    >
      {{ getSelectedOutputCount(item.asset) }}
    </button>
  `
}

const buttonStub = {
  template: '<button><slot /></button>'
}

const selectionBarStub = {
  props: ['count'],
  template: '<div data-testid="selection-count">{{ count }} selected</div>'
}

const filterBarStub = {
  props: ['viewMode'],
  emits: ['update:viewMode'],
  template: `
    <button
      aria-label="Show list view"
      @click="$emit('update:viewMode', 'list')"
    />
    <button
      aria-label="Show grid view"
      @click="$emit('update:viewMode', 'grid')"
    />
  `
}

function renderTab() {
  return render(AssetsSidebarTab, {
    global: {
      plugins: [i18n, createTestingPinia({ stubActions: false })],
      directives: {
        tooltip: {}
      },
      stubs: {
        SidebarTabTemplate: sidebarTabTemplateStub,
        AssetsSidebarGridView: assetsGridStub,
        AssetsSidebarListView: assetsListStub,
        Button: buttonStub,
        MediaAssetFilterBar: filterBarStub,
        MediaAssetSelectionBar: selectionBarStub,
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
    localStorage.setItem('Comfy.Assets.Sidebar.ViewMode', 'grid')
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

  it('preserves a grouped selection when entering the output folder', async () => {
    renderTab()

    await userEvent.click(
      screen.getByRole('button', { name: 'Select multi-output.png' })
    )
    expect(screen.getByTestId('selection-count')).toHaveTextContent(
      '2 selected'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Enter output folder' })
    )

    expect(
      screen.getByRole('button', { name: 'Select multi-output-a.png' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Select multi-output-b.png' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('selection-count')).toHaveTextContent(
      '2 selected'
    )
  })

  it('preserves a partial output selection when leaving and reopening the folder', async () => {
    renderTab()

    await userEvent.click(
      screen.getByRole('button', { name: 'Enter output folder' })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Select multi-output-a.png' })
    )
    expect(screen.getByTestId('selection-count')).toHaveTextContent(
      '1 selected'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to all assets' })
    )

    expect(screen.getByTestId('selection-count')).toHaveTextContent(
      '1 selected'
    )
    expect(
      screen.getByRole('button', { name: 'Enter output folder' })
    ).toHaveTextContent('1/2')
    expect(
      screen.getByRole('button', { name: 'Select multi-output.png' })
    ).toHaveAttribute('aria-pressed', 'mixed')

    await userEvent.click(
      screen.getByRole('button', { name: 'Show list view' })
    )
    expect(screen.getByTestId('selection-count')).toHaveTextContent(
      '1 selected'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Show grid view' })
    )
    expect(
      screen.getByRole('button', { name: 'Select multi-output.png' })
    ).toHaveAttribute('aria-pressed', 'mixed')

    await userEvent.click(
      screen.getByRole('button', { name: 'Enter output folder' })
    )

    expect(
      screen.getByRole('button', { name: 'Select multi-output-a.png' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Select multi-output-b.png' })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles an inherited child selection in list view and preserves it in grid view', async () => {
    localStorage.setItem('Comfy.Assets.Sidebar.ViewMode', 'list')
    const user = userEvent.setup()
    renderTab()

    await user.click(
      screen.getByRole('button', { name: 'List select multi-output.png' })
    )
    await user.click(screen.getByRole('button', { name: 'Expand list group' }))

    const parent = screen.getByRole('button', {
      name: 'List select multi-output.png'
    })
    const childA = await screen.findByRole('button', {
      name: 'List select multi-output-a.png'
    })
    const childB = screen.getByRole('button', {
      name: 'List select multi-output-b.png'
    })

    expect(parent).toHaveAttribute('aria-pressed', 'true')
    expect(childA).toHaveAttribute('aria-pressed', 'true')
    expect(childB).toHaveAttribute('aria-pressed', 'true')

    async function toggleChildB() {
      await user.keyboard('{Control>}')
      await user.click(childB)
      await user.keyboard('{/Control}')
    }

    await toggleChildB()

    expect(parent).toHaveAttribute('aria-pressed', 'mixed')
    expect(childB).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('selection-count')).toHaveTextContent(
      '1 selected'
    )

    await toggleChildB()

    expect(childB).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('selection-count')).toHaveTextContent(
      '2 selected'
    )

    await toggleChildB()

    await user.click(screen.getByRole('button', { name: 'Show grid view' }))

    expect(
      screen.getByRole('button', { name: 'Select multi-output.png' })
    ).toHaveAttribute('aria-pressed', 'mixed')
    expect(
      screen.getByRole('button', { name: 'Enter output folder' })
    ).toHaveTextContent('1/2')
  })
})
