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
    :data-secondary-text="secondaryText"
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

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
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

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
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

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const trigger = container.querySelector(
      '[data-testid="preview-click-trigger"]'
    )!
    // eslint-disable-next-line testing-library/prefer-user-event
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

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const stub = container.querySelector('[data-testid="assets-list-item"]')!
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.dblClick(stub)

    expect(onPreviewAsset).toHaveBeenCalledWith(imageAsset)
  })

  describe('secondary text', () => {
    function getSecondaryText(container: Element): string {
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- reading rendered prop via stub attribute
      const stub = container.querySelector('[data-testid="assets-list-item"]')
      return stub?.getAttribute('data-secondary-text') ?? ''
    }

    it('renders just the extension when no size or duration is available', () => {
      const asset = buildAsset('extension-only', 'photo.png')
      const { container } = renderListView([buildOutputItem(asset)])
      expect(getSecondaryText(container)).toBe('PNG')
    })

    it('prepends the extension to the formatted size when no duration is available', () => {
      const asset = {
        ...buildAsset('with-size', 'note.txt'),
        size: 2048
      } satisfies AssetItem
      const { container } = renderListView([buildOutputItem(asset)])
      expect(getSecondaryText(container)).toBe('TXT 2 KB')
    })

    it('prepends the extension to the execution time when present in metadata', () => {
      const asset = {
        ...buildAsset('with-exec-time', 'clip.mp4'),
        user_metadata: {
          jobId: 'job-1',
          nodeId: '7',
          subfolder: '',
          executionTimeInSeconds: 1.234
        }
      } satisfies AssetItem
      const { container } = renderListView([buildOutputItem(asset)])
      expect(getSecondaryText(container)).toBe('MP4 1.23s')
    })

    it('prepends the extension to the duration when no execution time is present', () => {
      const asset = {
        ...buildAsset('with-duration', 'song.mp3'),
        user_metadata: { duration: 65000 }
      } satisfies AssetItem
      const { container } = renderListView([buildOutputItem(asset)])
      expect(getSecondaryText(container)).toBe('MP3 1m 5s')
    })
  })
})
