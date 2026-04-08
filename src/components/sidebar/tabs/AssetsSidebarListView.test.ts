/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/prefer-user-event */
/* eslint-disable vue/one-component-per-file */
import { render, fireEvent } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { OutputStackListItem } from '@/platform/assets/composables/useOutputStacks'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

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

const AssetsListItemStub = defineComponent({
  name: 'AssetsListItem',
  props: {
    previewUrl: { type: String, default: '' },
    isVideoPreview: { type: Boolean, default: false },
    previewAlt: { type: String, default: '' },
    iconName: { type: String, default: '' },
    iconAriaLabel: { type: String, default: '' },
    iconClass: { type: String, default: '' },
    iconWrapperClass: { type: String, default: '' },
    primaryText: { type: String, default: '' },
    secondaryText: { type: String, default: '' },
    stackCount: { type: Number, default: 0 },
    stackIndicatorLabel: { type: String, default: '' },
    stackExpanded: { type: Boolean, default: false },
    progressTotalPercent: { type: Number, default: undefined },
    progressCurrentPercent: { type: Number, default: undefined }
  },
  template: `<div
    class="assets-list-item-stub"
    :data-preview-url="previewUrl"
    :data-is-video-preview="isVideoPreview"
    data-testid="assets-list-item"
  ><button data-testid="preview-click-trigger" @click="$emit('preview-click')" /><slot /></div>`
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

function renderListView(
  assetItems: OutputStackListItem[] = [],
  props: Record<string, unknown> = {}
) {
  return render(AssetsSidebarListView, {
    props: {
      assetItems,
      selectableAssets: [],
      isSelected: () => false,
      isStackExpanded: () => false,
      toggleStack: async () => {},
      ...props
    },
    global: {
      stubs: {
        VirtualGrid: VirtualGridStub,
        AssetsListItem: AssetsListItemStub
      }
    }
  })
}

describe('AssetsSidebarListView', () => {
  it('marks mp4 assets as video previews', () => {
    const videoAsset = {
      ...buildAsset('video-asset', 'clip.mp4'),
      preview_url: '/api/view/clip.mp4',
      user_metadata: {}
    } satisfies AssetItem

    const { container } = renderListView([buildOutputItem(videoAsset)])

    const stubs = container.querySelectorAll('[data-testid="assets-list-item"]')
    const assetListItem = stubs[stubs.length - 1]

    expect(assetListItem).toBeDefined()
    expect(assetListItem?.getAttribute('data-preview-url')).toBe(
      '/api/view/clip.mp4'
    )
    expect(assetListItem?.getAttribute('data-is-video-preview')).toBe('true')
  })

  it('uses icon fallback for text assets even when preview_url exists', () => {
    const textAsset = {
      ...buildAsset('text-asset', 'notes.txt'),
      preview_url: '/api/view/notes.txt',
      user_metadata: {}
    } satisfies AssetItem

    const { container } = renderListView([buildOutputItem(textAsset)])

    const stubs = container.querySelectorAll('[data-testid="assets-list-item"]')
    const assetListItem = stubs[stubs.length - 1]

    expect(assetListItem).toBeDefined()
    expect(assetListItem?.getAttribute('data-preview-url')).toBe('')
    expect(assetListItem?.getAttribute('data-is-video-preview')).toBe('false')
  })

  it('emits preview-asset when item preview is clicked', async () => {
    const imageAsset = {
      ...buildAsset('image-asset', 'image.png'),
      preview_url: '/api/view/image.png',
      user_metadata: {}
    } satisfies AssetItem

    const onPreviewAsset = vi.fn()
    const { container } = renderListView([buildOutputItem(imageAsset)], {
      'onPreview-asset': onPreviewAsset
    })

    const trigger = container.querySelector(
      '[data-testid="preview-click-trigger"]'
    )!
    await fireEvent.click(trigger)

    expect(onPreviewAsset).toHaveBeenCalledWith(imageAsset)
  })

  it('emits preview-asset when item is double-clicked', async () => {
    const imageAsset = {
      ...buildAsset('image-asset-dbl', 'image.png'),
      preview_url: '/api/view/image.png',
      user_metadata: {}
    } satisfies AssetItem

    const onPreviewAsset = vi.fn()
    const { container } = renderListView([buildOutputItem(imageAsset)], {
      'onPreview-asset': onPreviewAsset
    })

    const stub = container.querySelector('[data-testid="assets-list-item"]')!
    await fireEvent.dblClick(stub)

    expect(onPreviewAsset).toHaveBeenCalledWith(imageAsset)
  })
})
