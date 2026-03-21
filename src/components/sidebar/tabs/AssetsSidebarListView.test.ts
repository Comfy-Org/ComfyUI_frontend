import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import type { OutputStackListItem } from '@/platform/assets/composables/useOutputStacks'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import AssetsSidebarListView from './AssetsSidebarListView.vue'

vi.mock('@/platform/assets/composables/useMediaAssetMenu', () => ({
  useMediaAssetMenu: () => ({
    getMenuEntries: () => []
  })
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    isAssetDeleting: () => false
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {}
  }
})

const VirtualGridStub = {
  name: 'VirtualGrid',
  props: {
    items: {
      type: Array,
      default: () => []
    }
  },
  template:
    '<div><slot v-for="item in items" :key="item.key" name="item" :item="item" /></div>'
}

const AssetsListItemStub = {
  name: 'AssetsListItem',
  template:
    '<div class="assets-list-item-stub"><slot /><slot name="actions" /></div>'
}

const ContextMenuStub = {
  name: 'ContextMenu',
  template:
    '<div class="context-menu-stub"><slot /><slot name="content" v-bind="{ close: () => {}, itemComponent: \'div\', separatorComponent: \'div\' }" /></div>'
}

const DropdownMenuStub = {
  name: 'DropdownMenu',
  props: {
    open: {
      type: Boolean,
      default: false
    }
  },
  template:
    '<div class="dropdown-menu-stub"><slot name="button" /><slot name="content" v-bind="{ close: () => {}, itemComponent: \'div\', separatorComponent: \'div\' }" /></div>'
}

const ButtonComponentStub = {
  name: 'AppButton',
  template: '<button class="button-stub" type="button"><slot /></button>'
}

const MenuPanelStub = {
  name: 'MenuPanel',
  template: '<div class="menu-panel-stub" />'
}

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
      toggleStack: async () => {}
    },
    global: {
      plugins: [i18n],
      stubs: {
        VirtualGrid: VirtualGridStub
      }
    }
  })

const mountInteractiveListView = (assetItems: OutputStackListItem[] = []) =>
  mount(AssetsSidebarListView, {
    props: {
      assetItems,
      selectableAssets: [],
      isSelected: () => false,
      isStackExpanded: () => false,
      toggleStack: async () => {}
    },
    global: {
      plugins: [i18n],
      stubs: {
        AssetsListItem: AssetsListItemStub,
        Button: ButtonComponentStub,
        ContextMenu: ContextMenuStub,
        DropdownMenu: DropdownMenuStub,
        MenuPanel: MenuPanelStub,
        VirtualGrid: VirtualGridStub
      }
    }
  })

describe('AssetsSidebarListView', () => {
  it('marks mp4 assets as video previews', () => {
    const videoAsset = {
      ...buildAsset('video-asset', 'clip.mp4'),
      preview_url: '/api/view/clip.mp4',
      user_metadata: {}
    } satisfies AssetItem

    const wrapper = mountListView([buildOutputItem(videoAsset)])

    const listItems = wrapper.findAllComponents({ name: 'AssetsListItem' })
    const assetListItem = listItems.at(-1)

    expect(assetListItem).toBeDefined()
    expect(assetListItem?.props('previewUrl')).toBe('/api/view/clip.mp4')
    expect(assetListItem?.props('isVideoPreview')).toBe(true)
  })

  it('uses icon fallback for text assets even when preview_url exists', () => {
    const textAsset = {
      ...buildAsset('text-asset', 'notes.txt'),
      preview_url: '/api/view/notes.txt',
      user_metadata: {}
    } satisfies AssetItem

    const wrapper = mountListView([buildOutputItem(textAsset)])

    const listItems = wrapper.findAllComponents({ name: 'AssetsListItem' })
    const assetListItem = listItems.at(-1)

    expect(assetListItem).toBeDefined()
    expect(assetListItem?.props('previewUrl')).toBe('')
    expect(assetListItem?.props('isVideoPreview')).toBe(false)
  })

  it('emits preview-asset when item preview is clicked', async () => {
    const imageAsset = {
      ...buildAsset('image-asset', 'image.png'),
      preview_url: '/api/view/image.png',
      user_metadata: {}
    } satisfies AssetItem

    const wrapper = mountListView([buildOutputItem(imageAsset)])
    const listItems = wrapper.findAllComponents({ name: 'AssetsListItem' })
    const assetListItem = listItems.at(-1)

    expect(assetListItem).toBeDefined()

    assetListItem!.vm.$emit('preview-click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('preview-asset')).toEqual([[imageAsset]])
  })

  it('emits preview-asset when item is double-clicked', async () => {
    const imageAsset = {
      ...buildAsset('image-asset-dbl', 'image.png'),
      preview_url: '/api/view/image.png',
      user_metadata: {}
    } satisfies AssetItem

    const wrapper = mountListView([buildOutputItem(imageAsset)])
    const listItems = wrapper.findAllComponents({ name: 'AssetsListItem' })
    const assetListItem = listItems.at(-1)

    expect(assetListItem).toBeDefined()

    await assetListItem!.trigger('dblclick')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('preview-asset')).toEqual([[imageAsset]])
  })

  it('keeps row actions mounted while the dropdown is open', async () => {
    const imageAsset = {
      ...buildAsset('image-asset-open', 'image.png'),
      user_metadata: {}
    } satisfies AssetItem

    const wrapper = mountInteractiveListView([buildOutputItem(imageAsset)])
    const assetListItem = wrapper.find('.assets-list-item-stub')

    await assetListItem.trigger('mouseenter')

    const actionsMenu = wrapper.findComponent(DropdownMenuStub)
    expect(actionsMenu.exists()).toBe(true)

    actionsMenu.vm.$emit('update:open', true)
    await nextTick()
    await assetListItem.trigger('mouseleave')
    await nextTick()

    expect(wrapper.findComponent(DropdownMenuStub).exists()).toBe(true)

    wrapper.findComponent(DropdownMenuStub).vm.$emit('update:open', false)
    await nextTick()

    expect(wrapper.findComponent(DropdownMenuStub).exists()).toBe(false)
  })

  it('does not select the row when clicking the actions trigger', async () => {
    const imageAsset = {
      ...buildAsset('image-asset-actions', 'image.png'),
      user_metadata: {}
    } satisfies AssetItem

    const wrapper = mountInteractiveListView([buildOutputItem(imageAsset)])
    const assetListItem = wrapper.find('.assets-list-item-stub')

    await assetListItem.trigger('mouseenter')
    await wrapper.find('.button-stub').trigger('click')

    expect(wrapper.emitted('select-asset')).toBeUndefined()
  })
})
