import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const mockAssetService = vi.hoisted(() => ({
  getAssetsForNodeType: vi.fn(),
  getAssetsByTag: vi.fn(),
  getAssetDetails: vi.fn((id: string) =>
    Promise.resolve({
      id,
      name: 'Test Model',
      user_metadata: {
        filename: 'Test Model'
      }
    })
  )
}))

vi.mock('@/i18n', () => ({
  t: (key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  d: (date: Date) => date.toLocaleDateString()
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: mockAssetService
}))

vi.mock('@/stores/modelToNodeStore', () => ({
  useModelToNodeStore: () => ({
    getCategoryForNodeType: () => 'checkpoints'
  })
}))

vi.mock('@/components/input/SearchBox.vue', () => ({
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
        <button
          v-for="item in navItems"
          :key="item.id"
          @click="$emit('update:modelValue', item.id)"
          :data-testid="'nav-item-' + item.id"
          :class="{ active: modelValue === item.id }"
        >
          {{ item.label }}
        </button>
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

  const createWrapper = (props: Record<string, unknown>) => {
    const pinia = createPinia()
    setActivePinia(pinia)

    return mount(AssetBrowserModal, {
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
    mockAssetService.getAssetsForNodeType.mockReset()
    mockAssetService.getAssetsByTag.mockReset()
  })

  describe('Integration with useAssetBrowser', () => {
    it('passes filtered assets from composable to AssetGrid', async () => {
      const assets = [
        createTestAsset('asset1', 'Model A', 'checkpoints'),
        createTestAsset('asset2', 'Model B', 'loras')
      ]
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce(assets)

      const wrapper = createWrapper({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      const assetGrid = wrapper.findComponent({ name: 'AssetGrid' })
      const gridAssets = assetGrid.props('assets') as AssetItem[]

      expect(gridAssets).toHaveLength(2)
      expect(gridAssets[0].id).toBe('asset1')
    })

    it('passes category-filtered assets to AssetFilterBar', async () => {
      const assets = [
        createTestAsset('c1', 'model.safetensors', 'checkpoints'),
        createTestAsset('l1', 'lora.pt', 'loras')
      ]
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce(assets)

      const wrapper = createWrapper({
        nodeType: 'CheckpointLoaderSimple',
        showLeftPanel: true
      })
      await flushPromises()

      const filterBar = wrapper.findComponent({ name: 'AssetFilterBar' })
      const filterBarAssets = filterBar.props('assets') as AssetItem[]

      expect(filterBarAssets).toHaveLength(2)
    })
  })

  describe('Data fetching', () => {
    it('fetches assets for node type', async () => {
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce([])

      createWrapper({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      expect(mockAssetService.getAssetsForNodeType).toHaveBeenCalledWith(
        'CheckpointLoaderSimple'
      )
    })

    it('fetches assets for tag when node type not provided', async () => {
      mockAssetService.getAssetsByTag.mockResolvedValueOnce([])

      createWrapper({ assetType: 'loras' })
      await flushPromises()

      expect(mockAssetService.getAssetsByTag).toHaveBeenCalledWith('loras')
    })
  })

  describe('Asset Selection', () => {
    it('emits asset-select event when asset is selected', async () => {
      const assets = [createTestAsset('asset1', 'Model A', 'checkpoints')]
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce(assets)

      const wrapper = createWrapper({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      const assetGrid = wrapper.findComponent({ name: 'AssetGrid' })
      await assetGrid.vm.$emit('asset-select', assets[0])

      expect(wrapper.emitted('asset-select')).toEqual([[assets[0]]])
    })

    it('executes onSelect callback when provided', async () => {
      const assets = [createTestAsset('asset1', 'Model A', 'checkpoints')]
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce(assets)

      const onSelect = vi.fn()
      const wrapper = createWrapper({
        nodeType: 'CheckpointLoaderSimple',
        onSelect
      })
      await flushPromises()

      const assetGrid = wrapper.findComponent({ name: 'AssetGrid' })
      await assetGrid.vm.$emit('asset-select', assets[0])

      expect(onSelect).toHaveBeenCalledWith(assets[0])
    })
  })

  describe('Left Panel Conditional Logic', () => {
    it('hides left panel by default when showLeftPanel is undefined', async () => {
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce([])

      const wrapper = createWrapper({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      const leftPanel = wrapper.find('[data-testid="left-panel"]')
      expect(leftPanel.exists()).toBe(false)
    })

    it('shows left panel when showLeftPanel prop is explicitly true', async () => {
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce([])

      const wrapper = createWrapper({
        nodeType: 'CheckpointLoaderSimple',
        showLeftPanel: true
      })
      await flushPromises()

      const leftPanel = wrapper.find('[data-testid="left-panel"]')
      expect(leftPanel.exists()).toBe(true)
    })
  })

  describe('Filter Options Reactivity', () => {
    it('updates filter options when category changes', async () => {
      const assets = [
        createTestAsset('asset1', 'Model A', 'checkpoints'),
        createTestAsset('asset2', 'Model B', 'loras')
      ]
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce(assets)

      const wrapper = createWrapper({
        nodeType: 'CheckpointLoaderSimple',
        showLeftPanel: true
      })
      await flushPromises()

      const filterBar = wrapper.findComponent({ name: 'AssetFilterBar' })
      expect(filterBar.props('assets')).toHaveLength(2)

      const leftPanel = wrapper.findComponent({ name: 'LeftSidePanel' })
      await leftPanel.vm.$emit('update:modelValue', 'loras')
      await wrapper.vm.$nextTick()

      expect(filterBar.props('assets')).toHaveLength(1)
    })
  })

  describe('Title Management', () => {
    it('passes custom title to BaseModalLayout when title prop provided', async () => {
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce([])

      const wrapper = createWrapper({
        nodeType: 'CheckpointLoaderSimple',
        title: 'Custom Title'
      })
      await flushPromises()

      const layout = wrapper.findComponent({ name: 'BaseModalLayout' })
      expect(layout.props('contentTitle')).toBe('Custom Title')
    })

    it('passes computed contentTitle to BaseModalLayout when no title prop', async () => {
      const assets = [createTestAsset('asset1', 'Model A', 'checkpoints')]
      mockAssetService.getAssetsForNodeType.mockResolvedValueOnce(assets)

      const wrapper = createWrapper({ nodeType: 'CheckpointLoaderSimple' })
      await flushPromises()

      const layout = wrapper.findComponent({ name: 'BaseModalLayout' })
      expect(layout.props('contentTitle')).toBe(
        'assetBrowser.allCategory:{"category":"Checkpoints"}'
      )
    })
  })
})
