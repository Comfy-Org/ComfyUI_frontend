import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

// Mock @/i18n for useAssetBrowser and AssetFilterBar
vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  d: (date: Date) => date.toLocaleDateString()
}))

// Mock assetService for useAssetBrowser
vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: {
    getAssetDetails: vi.fn((id: string) =>
      Promise.resolve({
        id,
        name: 'Test Model',
        user_metadata: {
          filename: 'Test Model'
        }
      })
    )
  }
}))

// Mock external dependencies with minimal functionality needed for business logic tests
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
    props: ['assets'],
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
    t: (key: string) => key
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key
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

  const createWrapper = (
    assets: AssetItem[] = [],
    props: Record<string, unknown> = {}
  ) => {
    const pinia = createPinia()
    setActivePinia(pinia)

    return mount(AssetBrowserModal, {
      props: {
        assets: assets,
        ...props
      },
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

  describe('Integration with useAssetBrowser', () => {
    it('passes filteredAssets from composable to AssetGrid', () => {
      const assets = [
        createTestAsset('asset1', 'Model A', 'checkpoints'),
        createTestAsset('asset2', 'Model B', 'loras')
      ]
      const wrapper = createWrapper(assets)

      const assetGrid = wrapper.findComponent({ name: 'AssetGrid' })
      const gridAssets = assetGrid.props('assets')

      expect(gridAssets).toHaveLength(2)
      expect(gridAssets[0].id).toBe('asset1')
    })

    it('passes categoryFilteredAssets to AssetFilterBar', () => {
      const assets = [
        createTestAsset('c1', 'model.safetensors', 'checkpoints'),
        createTestAsset('l1', 'lora.pt', 'loras')
      ]
      const wrapper = createWrapper(assets, { showLeftPanel: true })

      const filterBar = wrapper.findComponent({ name: 'AssetFilterBar' })
      const filterBarAssets = filterBar.props('assets')

      // Should initially show all assets
      expect(filterBarAssets).toHaveLength(2)
    })
  })

  describe('Asset Selection', () => {
    it('emits asset-select event when asset is selected', async () => {
      const assets = [createTestAsset('asset1', 'Test Model', 'checkpoints')]
      const wrapper = createWrapper(assets)

      // Click on first asset
      await wrapper.find('[data-testid="asset-asset1"]').trigger('click')

      const emitted = wrapper.emitted('asset-select')
      expect(emitted).toBeDefined()
      expect(emitted).toHaveLength(1)

      const emittedAsset = emitted![0][0] as AssetItem
      expect(emittedAsset.id).toBe('asset1')
    })

    it('executes onSelect callback when provided', async () => {
      const onSelectSpy = vi.fn()
      const assets = [createTestAsset('asset1', 'Test Model', 'checkpoints')]
      const wrapper = createWrapper(assets, { onSelect: onSelectSpy })

      // Click on first asset
      await wrapper.find('[data-testid="asset-asset1"]').trigger('click')

      expect(onSelectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'asset1',
          name: 'Test Model'
        })
      )
    })
  })

  describe('Left Panel Conditional Logic', () => {
    it('hides left panel by default when showLeftPanel prop is undefined', () => {
      const singleCategoryAssets = [
        createTestAsset('single1', 'Asset 1', 'checkpoints'),
        createTestAsset('single2', 'Asset 2', 'checkpoints')
      ]
      const wrapper = createWrapper(singleCategoryAssets)

      expect(wrapper.find('[data-testid="left-panel"]').exists()).toBe(false)
    })

    it('shows left panel when showLeftPanel prop is explicitly true', () => {
      const singleCategoryAssets = [
        createTestAsset('single1', 'Asset 1', 'checkpoints')
      ]

      // Force show even with single category
      const wrapper = createWrapper(singleCategoryAssets, {
        showLeftPanel: true
      })
      expect(wrapper.find('[data-testid="left-panel"]').exists()).toBe(true)

      // Force hide even with multiple categories
      wrapper.unmount()
      const multiCategoryAssets = [
        createTestAsset('asset1', 'Checkpoint', 'checkpoints'),
        createTestAsset('asset2', 'LoRA', 'loras')
      ]
      const wrapper2 = createWrapper(multiCategoryAssets, {
        showLeftPanel: false
      })
      expect(wrapper2.find('[data-testid="left-panel"]').exists()).toBe(false)
    })
  })

  describe('Filter Options Reactivity', () => {
    it('updates filter options when category changes', async () => {
      const assets = [
        createTestAsset('c1', 'model.safetensors', 'checkpoints'),
        createTestAsset('c2', 'another.safetensors', 'checkpoints'),
        createTestAsset('l1', 'lora.pt', 'loras')
      ]
      const wrapper = createWrapper(assets, { showLeftPanel: true })

      // Initially on "all" category - should have both .safetensors and .pt
      const filterBar = wrapper.findComponent({ name: 'AssetFilterBar' })
      expect(filterBar.exists()).toBe(true)

      // Switch to checkpoints category
      const checkpointsNav = wrapper.find(
        '[data-testid="nav-item-checkpoints"]'
      )
      expect(checkpointsNav.exists()).toBe(true)
      await checkpointsNav.trigger('click')

      // Filter bar should receive only checkpoint assets now
      const updatedFilterBar = wrapper.findComponent({ name: 'AssetFilterBar' })
      const filterBarAssets = updatedFilterBar.props('assets')

      expect(filterBarAssets).toHaveLength(2)
      expect(
        filterBarAssets.every((a: AssetItem) => a.tags.includes('checkpoints'))
      ).toBe(true)
    })
  })

  describe('Title Management', () => {
    it('passes custom title to BaseModalLayout when title prop provided', () => {
      const assets = [createTestAsset('asset1', 'Test Model', 'checkpoints')]
      const customTitle = 'Model Library'
      const wrapper = createWrapper(assets, { title: customTitle })

      const baseModal = wrapper.findComponent({ name: 'BaseModalLayout' })
      expect(baseModal.props('contentTitle')).toBe(customTitle)
    })

    it('passes computed contentTitle to BaseModalLayout when no title prop', () => {
      const assets = [createTestAsset('asset1', 'Test Model', 'checkpoints')]
      const wrapper = createWrapper(assets)

      const baseModal = wrapper.findComponent({ name: 'BaseModalLayout' })
      // Should use contentTitle from useAssetBrowser (e.g., "All Models")
      expect(baseModal.props('contentTitle')).toBeTruthy()
      expect(baseModal.props('contentTitle')).not.toBe('')
    })
  })
})
