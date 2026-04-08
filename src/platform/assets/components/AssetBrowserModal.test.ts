/* eslint-disable testing-library/no-node-access */
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'

const mockAssetsByKey = vi.hoisted(() => new Map<string, AssetItem[]>())
const mockLoadingByKey = vi.hoisted(() => new Map<string, boolean>())

vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  d: (date: Date) => date.toLocaleDateString()
}))

vi.mock('@/stores/assetsStore', () => {
  const getAssets = vi.fn((key: string) => mockAssetsByKey.get(key) ?? [])
  const isModelLoading = vi.fn(
    (key: string) => mockLoadingByKey.get(key) ?? false
  )
  const updateModelsForNodeType = vi.fn()
  const updateModelsForTag = vi.fn()
  return {
    useAssetsStore: () => ({
      getAssets,
      isModelLoading,
      updateModelsForNodeType,
      updateModelsForTag
    })
  }
})

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getCategoryForNodeType: () => 'checkpoints'
  })
}))

vi.mock('@/components/common/SearchBox.vue', () => ({
  default: {
    name: 'SearchBox',
    props: ['modelValue', 'size', 'placeholder', 'class'],
    emits: ['update:modelValue'],
    template: `
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        data-testid="search-box"
      />
    `
  }
}))

vi.mock('@/components/widget/layout/BaseModalLayout.vue', () => ({
  default: {
    name: 'BaseModalLayout',
    props: ['contentTitle'],
    emits: ['close'],
    template: `
      <div data-testid="base-modal-layout">
        <span data-testid="modal-title">{{ contentTitle }}</span>
        <div v-if="$slots.leftPanel" data-testid="left-panel">
          <slot name="leftPanel" />
        </div>
        <div data-testid="header">
          <slot name="header" />
        </div>
        <div v-if="$slots.contentFilter" data-testid="content-filter">
          <slot name="contentFilter" />
        </div>
        <div data-testid="content">
          <slot name="content" />
        </div>
      </div>
    `
  }
}))

vi.mock('@/components/widget/panel/LeftSidePanel.vue', () => ({
  default: {
    name: 'LeftSidePanel',
    props: ['modelValue', 'navItems'],
    emits: ['update:modelValue'],
    template: `
      <div data-testid="left-side-panel">
        <div v-if="$slots['header-title']" data-testid="header-title">
          <slot name="header-title" />
        </div>
        <template v-for="item in navItems" :key="item.id || item.title">
          <button
            v-if="item.id"
            @click="$emit('update:modelValue', item.id)"
            :data-testid="'nav-item-' + item.id"
            :class="{ active: modelValue === item.id }"
          >
            {{ item.label }}
          </button>
          <template v-else-if="item.items">
            <button
              v-for="child in item.items"
              :key="child.id"
              @click="$emit('update:modelValue', child.id)"
              :data-testid="'nav-item-' + child.id"
              :class="{ active: modelValue === child.id }"
            >
              {{ child.label }}
            </button>
          </template>
        </template>
      </div>
    `
  }
}))

vi.mock('@/platform/assets/components/AssetFilterBar.vue', () => ({
  default: {
    name: 'AssetFilterBar',
    props: ['assets'],
    emits: ['filter-change'],
    template: `
      <div data-testid="asset-filter-bar">
        Filter bar with {{ assets?.length ?? 0 }} assets
      </div>
    `
  }
}))

vi.mock('@/platform/assets/components/AssetGrid.vue', () => ({
  default: {
    name: 'AssetGrid',
    props: ['assets', 'loading'],
    emits: ['asset-select'],
    template: `
      <div data-testid="asset-grid">
        <div
          v-for="asset in assets"
          :key="asset.id"
          @click="$emit('asset-select', asset)"
          :data-testid="'asset-' + asset.id"
          class="asset-card"
        >
          {{ asset.name }}
        </div>
        <div v-if="assets.length === 0" data-testid="empty-state">
          No assets found
        </div>
      </div>
    `
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  }),
  createI18n: () => ({
    global: {
      t: (key: string, params?: Record<string, string>) =>
        params ? `${key}:${JSON.stringify(params)}` : key
    }
  })
}))

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('AssetBrowserModal', () => {
  const createTestAsset = (
    id: string,
    name: string,
    category: string
  ): AssetItem => ({
    id,
    name,
    asset_hash: `blake3:${id.padEnd(64, '0')}`,
    size: 1024000,
    mime_type: 'application/octet-stream',
    tags: ['models', category, 'test'],
    preview_url: `/api/assets/${id}/content`,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_access_time: '2024-01-01T00:00:00Z',
    user_metadata: {
      description: `Test ${name}`,
      base_model: 'sd15'
    }
  })

  function renderModal(props: Record<string, unknown>) {
    const pinia = createPinia()
    setActivePinia(pinia)

    return render(AssetBrowserModal, {
      props,
      global: {
        plugins: [pinia],
        stubs: {
          'i-lucide:folder': {
            template: '<div data-testid="folder-icon"></div>'
          }
        },
        mocks: {
          $t: (key: string) => key
        }
      }
    })
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockAssetsByKey.clear()
    mockLoadingByKey.clear()
  })

  describe('Integration with useAssetBrowser', () => {
    it('passes filtered assets from composable to AssetGrid', async () => {
      const assets = [
        createTestAsset('asset1', 'Model A', 'checkpoints'),
        createTestAsset('asset2', 'Model B', 'loras')
      ]
      mockAssetsByKey.set('CheckpointLoaderSimple', assets)

      renderModal({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      expect(screen.getByTestId('asset-asset1')).toBeDefined()
      expect(screen.getByTestId('asset-asset2')).toBeDefined()
      expect(
        screen.getByTestId('asset-grid').querySelectorAll('.asset-card')
      ).toHaveLength(2)
    })

    it('passes category-filtered assets to AssetFilterBar', async () => {
      const assets = [
        createTestAsset('c1', 'model.safetensors', 'checkpoints'),
        createTestAsset('l1', 'lora.pt', 'loras')
      ]
      mockAssetsByKey.set('CheckpointLoaderSimple', assets)

      renderModal({
        nodeType: 'CheckpointLoaderSimple',
        showLeftPanel: true
      })
      await flushPromises()

      expect(screen.getByTestId('asset-filter-bar').textContent).toContain(
        '2 assets'
      )
    })
  })

  describe('Data fetching', () => {
    it('triggers store refresh for node type on mount', async () => {
      const store = useAssetsStore()
      renderModal({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      expect(store.updateModelsForNodeType).toHaveBeenCalledWith(
        'CheckpointLoaderSimple'
      )
    })

    it('displays cached assets immediately from store', async () => {
      const assets = [createTestAsset('asset1', 'Cached Model', 'checkpoints')]
      mockAssetsByKey.set('CheckpointLoaderSimple', assets)

      renderModal({ nodeType: 'CheckpointLoaderSimple' })

      expect(screen.getByTestId('asset-asset1')).toBeDefined()
      expect(screen.getByTestId('asset-asset1').textContent).toContain(
        'Cached Model'
      )
    })

    it('triggers store refresh for asset type (tag) on mount', async () => {
      const store = useAssetsStore()
      renderModal({ assetType: 'models' })
      await flushPromises()

      expect(store.updateModelsForTag).toHaveBeenCalledWith('models')
    })

    it('uses tag: prefix for cache key when assetType is provided', async () => {
      const assets = [createTestAsset('asset1', 'Tagged Model', 'models')]
      mockAssetsByKey.set('tag:models', assets)

      renderModal({ assetType: 'models' })
      await flushPromises()

      expect(screen.getByTestId('asset-asset1')).toBeDefined()
      expect(screen.getByTestId('asset-asset1').textContent).toContain(
        'Tagged Model'
      )
    })
  })

  describe('Asset Selection', () => {
    it('emits asset-select event when asset is selected', async () => {
      const user = userEvent.setup()
      const assets = [createTestAsset('asset1', 'Model A', 'checkpoints')]
      mockAssetsByKey.set('CheckpointLoaderSimple', assets)

      const onAssetSelect = vi.fn()
      renderModal({
        nodeType: 'CheckpointLoaderSimple',
        'onAsset-select': onAssetSelect
      })
      await flushPromises()

      await user.click(screen.getByTestId('asset-asset1'))

      expect(onAssetSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: assets[0].id, name: assets[0].name })
      )
    })

    it('executes onSelect callback when provided', async () => {
      const user = userEvent.setup()
      const assets = [createTestAsset('asset1', 'Model A', 'checkpoints')]
      mockAssetsByKey.set('CheckpointLoaderSimple', assets)

      const onSelect = vi.fn()
      renderModal({
        nodeType: 'CheckpointLoaderSimple',
        onSelect
      })
      await flushPromises()

      await user.click(screen.getByTestId('asset-asset1'))

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: assets[0].id, name: assets[0].name })
      )
    })
  })

  describe('Left Panel Conditional Logic', () => {
    it('hides left panel by default when showLeftPanel is undefined', async () => {
      renderModal({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      expect(screen.queryByTestId('left-panel')).toBeNull()
    })

    it('shows left panel when showLeftPanel prop is explicitly true', async () => {
      renderModal({
        nodeType: 'CheckpointLoaderSimple',
        showLeftPanel: true
      })
      await flushPromises()

      expect(screen.getByTestId('left-panel')).toBeDefined()
    })

    it('hides left panel when showLeftPanel is false', async () => {
      renderModal({
        nodeType: 'CheckpointLoaderSimple',
        showLeftPanel: false
      })
      await flushPromises()

      expect(screen.queryByTestId('left-panel')).toBeNull()
    })
  })

  describe('Filter Options Reactivity', () => {
    it('updates filter options when category changes', async () => {
      const user = userEvent.setup()
      const assets = [
        createTestAsset('asset1', 'Model A', 'checkpoints'),
        createTestAsset('asset2', 'Model B', 'loras')
      ]
      mockAssetsByKey.set('CheckpointLoaderSimple', assets)

      renderModal({
        nodeType: 'CheckpointLoaderSimple',
        showLeftPanel: true
      })
      await flushPromises()

      expect(screen.getByTestId('asset-filter-bar').textContent).toContain(
        '2 assets'
      )

      await user.click(screen.getByTestId('nav-item-loras'))

      await waitFor(() => {
        expect(screen.getByTestId('asset-filter-bar').textContent).toContain(
          '1 assets'
        )
      })
    })
  })

  describe('Title Management', () => {
    it('passes custom title to BaseModalLayout when title prop provided', async () => {
      renderModal({
        nodeType: 'CheckpointLoaderSimple',
        title: 'Custom Title'
      })
      await flushPromises()

      expect(screen.getByTestId('modal-title').textContent).toBe('Custom Title')
    })

    it('passes computed contentTitle to BaseModalLayout when no title prop', async () => {
      const assets = [createTestAsset('asset1', 'Model A', 'checkpoints')]
      mockAssetsByKey.set('CheckpointLoaderSimple', assets)

      renderModal({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      expect(screen.getByTestId('modal-title').textContent).toBe(
        'assetBrowser.allCategory:{"category":"Checkpoints"}'
      )
    })
  })
})
