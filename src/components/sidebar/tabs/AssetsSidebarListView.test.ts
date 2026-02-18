import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { OutputStackListItem } from '@/platform/assets/composables/useOutputStacks'

import AssetsSidebarListView from './AssetsSidebarListView.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    isAssetDeleting: () => false
  })
}))

const VirtualGridStub = defineComponent({
  name: 'VirtualGrid',
  props: {
    items: {
      type: Array,
      default: () => []
    }
  },
  template:
    '<div><slot v-for="item in items" :key="item.key" name="item" :item="item" /></div>'
})

const buildAsset = (id: string, name: string): AssetItem =>
  ({
    id,
    name,
    tags: []
  }) satisfies AssetItem

const buildOutputItem = (asset: AssetItem): OutputStackListItem => ({
  key: `asset-${asset.id}`,
  asset
})

const mountListView = (assetItems: OutputStackListItem[] = []) =>
  mount(AssetsSidebarListView, {
    props: {
      assetItems,
      selectableAssets: [],
      isSelected: () => false,
      isStackExpanded: () => false,
      toggleStack: async () => {},
      assetType: 'output'
    },
    global: {
      stubs: {
        VirtualGrid: VirtualGridStub
      }
    }
  })

describe('AssetsSidebarListView', () => {
  it('shows generated assets header when there are assets', () => {
    const wrapper = mountListView([buildOutputItem(buildAsset('a1', 'x.png'))])

    expect(wrapper.text()).toContain('sideToolbar.generatedAssetsHeader')
  })

  it('does not show assets header when there are no assets', () => {
    const wrapper = mountListView([])

    expect(wrapper.text()).not.toContain('sideToolbar.generatedAssetsHeader')
  })
})
