import { VueWrapper, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import AssetBrowserModal from '@/platform/assets/components/AssetBrowserModal.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

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
  })
}))

describe('AssetBrowserModal', () => {
  let wrapper: VueWrapper

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

    wrapper = mount(AssetBrowserModal, {
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
    return wrapper
  }

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Search Functionality', () => {
    it('filters assets when search query changes', async () => {
      const assets = [
        createTestAsset('asset1', 'Checkpoint Model A', 'checkpoints'),
        createTestAsset('asset2', 'Checkpoint Model B', 'checkpoints'),
        createTestAsset('asset3', 'LoRA Model C', 'loras')
      ]
      createWrapper(assets)

      const searchBox = wrapper.find('[data-testid="search-box"]')

      // Search for "Checkpoint"
      await searchBox.setValue('Checkpoint')
      await nextTick()

      // Should filter to only checkpoint assets
      const assetGrid = wrapper.findComponent({ name: 'AssetGrid' })
      const filteredAssets = assetGrid.props('assets') as AssetDisplayItem[]

      expect(filteredAssets.length).toBe(2)
      expect(
        filteredAssets.every((asset: AssetDisplayItem) =>
          asset.name.includes('Checkpoint')
        )
      ).toBe(true)
    })

    it('search is case insensitive', async () => {
      const assets = [
        createTestAsset('asset1', 'LoRA Model C', 'loras'),
        createTestAsset('asset2', 'Checkpoint Model', 'checkpoints')
      ]
      createWrapper(assets)

      const searchBox = wrapper.find('[data-testid="search-box"]')

      // Search with different case
      await searchBox.setValue('lora')
      await nextTick()

      const assetGrid = wrapper.findComponent({ name: 'AssetGrid' })
      const filteredAssets = assetGrid.props('assets') as AssetDisplayItem[]

      expect(filteredAssets.length).toBe(1)
      expect(filteredAssets[0].name).toContain('LoRA')
    })

    it('shows empty state when search has no results', async () => {
      const assets = [
        createTestAsset('asset1', 'Checkpoint Model', 'checkpoints')
      ]
      createWrapper(assets)

      const searchBox = wrapper.find('[data-testid="search-box"]')

      // Search for something that doesn't exist
      await searchBox.setValue('nonexistent')
      await nextTick()

      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    })
  })

  describe('Category Navigation', () => {
    it('filters assets by selected category', async () => {
      const assets = [
        createTestAsset('asset1', 'Checkpoint Model A', 'checkpoints'),
        createTestAsset('asset2', 'LoRA Model C', 'loras'),
        createTestAsset('asset3', 'VAE Model D', 'vae')
      ]
      createWrapper(assets)

      // Wait for Vue reactivity and component mounting
      await nextTick()

      // Check if left panel exists first (since we have multiple categories)
      const leftPanel = wrapper.find('[data-testid="left-panel"]')
      expect(leftPanel.exists()).toBe(true)

      // Check if the nav item exists before clicking
      const lorasNavItem = wrapper.find('[data-testid="nav-item-loras"]')
      expect(lorasNavItem.exists()).toBe(true)

      // Click the loras category
      await lorasNavItem.trigger('click')
      await nextTick()

      // Should filter to only LoRA assets
      const assetGrid = wrapper.findComponent({ name: 'AssetGrid' })
      const filteredAssets = assetGrid.props('assets') as AssetDisplayItem[]

      expect(filteredAssets.length).toBe(1)
      expect(filteredAssets[0].name).toContain('LoRA')
    })
  })

  describe('Asset Selection', () => {
    it('emits asset-select event when asset is selected', async () => {
      const assets = [createTestAsset('asset1', 'Test Model', 'checkpoints')]
      createWrapper(assets)

      // Click on first asset
      await wrapper.find('[data-testid="asset-asset1"]').trigger('click')

      const emitted = wrapper.emitted('asset-select')
      expect(emitted).toBeDefined()
      expect(emitted).toHaveLength(1)

      const emittedAsset = emitted![0][0] as AssetDisplayItem
      expect(emittedAsset.id).toBe('asset1')
    })

    it('executes onSelect callback when provided', async () => {
      const onSelectSpy = vi.fn()
      const assets = [createTestAsset('asset1', 'Test Model', 'checkpoints')]
      createWrapper(assets, { onSelect: onSelectSpy })

      // Click on first asset
      await wrapper.find('[data-testid="asset-asset1"]').trigger('click')

      expect(onSelectSpy).toHaveBeenCalledWith('Test Model')
    })
  })

  describe('Left Panel Conditional Logic', () => {
    it('hides left panel when only one category exists', () => {
      const singleCategoryAssets = [
        createTestAsset('single1', 'Asset 1', 'checkpoints'),
        createTestAsset('single2', 'Asset 2', 'checkpoints')
      ]
      createWrapper(singleCategoryAssets)

      expect(wrapper.find('[data-testid="left-panel"]').exists()).toBe(false)
    })

    it('shows left panel when multiple categories exist', async () => {
      const multiCategoryAssets = [
        createTestAsset('asset1', 'Checkpoint', 'checkpoints'),
        createTestAsset('asset2', 'LoRA', 'loras')
      ]
      createWrapper(multiCategoryAssets)

      // Wait for Vue reactivity to compute shouldShowLeftPanel
      await nextTick()

      expect(wrapper.find('[data-testid="left-panel"]').exists()).toBe(true)
    })

    it('respects explicit showLeftPanel prop override', () => {
      const singleCategoryAssets = [
        createTestAsset('single1', 'Asset 1', 'checkpoints')
      ]

      // Force show even with single category
      createWrapper(singleCategoryAssets, { showLeftPanel: true })
      expect(wrapper.find('[data-testid="left-panel"]').exists()).toBe(true)

      // Force hide even with multiple categories
      wrapper.unmount()
      const multiCategoryAssets = [
        createTestAsset('asset1', 'Checkpoint', 'checkpoints'),
        createTestAsset('asset2', 'LoRA', 'loras')
      ]
      createWrapper(multiCategoryAssets, { showLeftPanel: false })
      expect(wrapper.find('[data-testid="left-panel"]').exists()).toBe(false)
    })
  })
})
