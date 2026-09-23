import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { OutputStackListItem } from '@/platform/assets/composables/useOutputStacks'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'

import AssetsSidebarListView from './AssetsSidebarListView.vue'

vi.mock(import('@/composables/useFeatureFlags'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

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
  ><button data-testid="preview-click-trigger" @click="$emit('preview-click')" /><slot /><slot name="actions" /></div>`
})

const buildAsset = (id: string, name: string): AssetItem =>
  fromPartial({
    id,
    name,
    tags: []
  })

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
      plugins: [i18n],
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
    expect(assetListItem.getAttribute('data-preview-url')).toBe(
      '/api/view/clip.mp4'
    )
    expect(assetListItem.getAttribute('data-is-video-preview')).toBe('true')
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
    expect(assetListItem.getAttribute('data-preview-url')).toBe('')
    expect(assetListItem.getAttribute('data-is-video-preview')).toBe('false')
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

  // A row that is not draggable, or that starts a drag carrying nothing, is
  // silently unattachable: the agent composer only accepts a drop whose
  // dataTransfer advertises MIME_ASSET_INFO (AgentPanelRoot `isAssetDrag`).
  describe('dragging an asset out of list view', () => {
    const dragAsset = {
      ...buildAsset('drag-asset', 'clip.mp4'),
      tags: ['output'],
      display_name: 'Clip',
      preview_url: '/api/view?filename=clip.mp4&type=output&subfolder=',
      user_metadata: {}
    } satisfies AssetItem

    function renderDraggableRow() {
      const { container } = renderListView([buildOutputItem(dragAsset)])
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the draggable row intentionally has no interactive role
      const row = container.querySelector('[data-testid="assets-list-item"]')!
      return row
    }

    function dispatchDragStart(
      row: Element,
      init: { ctrlKey?: boolean; metaKey?: boolean } = {}
    ) {
      const dataTransfer = new DataTransfer()
      const add = vi
        .spyOn(dataTransfer.items, 'add')
        .mockImplementation(() => null)
      const event = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true
      })
      // happy-dom's DragEvent ignores dataTransfer/modifier init, so set them here.
      Object.defineProperties(event, {
        dataTransfer: { value: dataTransfer, configurable: true },
        ctrlKey: { value: init.ctrlKey ?? false, configurable: true },
        metaKey: { value: init.metaKey ?? false, configurable: true }
      })
      row.dispatchEvent(event)
      return { event, add }
    }

    it('marks rows draggable so a native drag can start at all', () => {
      expect(renderDraggableRow().getAttribute('draggable')).toBe('true')
    })

    it('publishes the asset payload the composer resolves an attachment from', () => {
      const { event, add } = dispatchDragStart(renderDraggableRow())

      expect(event.defaultPrevented).toBe(false)
      expect(add).toHaveBeenCalledWith(
        JSON.stringify({
          filename: 'clip.mp4',
          type: 'output',
          display_name: 'Clip',
          attachment_ref: 'clip.mp4',
          media_kind: 'video',
          preview_url: undefined
        }),
        MIME_ASSET_INFO
      )
    })

    it('publishes the file URL as the uri-list flavour, as the grid card does', () => {
      const { add } = dispatchDragStart(renderDraggableRow())

      expect(add).toHaveBeenCalledWith(
        'http://localhost:3000/api/view?filename=clip.mp4&type=output&subfolder=',
        'text/uri-list'
      )
    })

    it.for([{ modifier: 'ctrlKey' }, { modifier: 'metaKey' }] as const)(
      'cancels the drag while $modifier is held, matching the grid card',
      ({ modifier }) => {
        const { event, add } = dispatchDragStart(renderDraggableRow(), {
          [modifier]: true
        })

        expect(event.defaultPrevented).toBe(true)
        expect(add).not.toHaveBeenCalled()
      }
    )
  })

  for (const [label, keys] of [
    ['Enter', '{Enter}'],
    ['Space', '{ }']
  ] as const) {
    it(`does not select a focused asset with ${label} (#16308: missing keyboard handler)`, async () => {
      const user = userEvent.setup()
      const imageAsset = {
        ...buildAsset(`image-asset-${label}`, 'image.png'),
        user_metadata: {}
      } satisfies AssetItem
      const onSelectAsset = vi.fn()

      renderListView([buildOutputItem(imageAsset)], {
        selectableAssets: [imageAsset],
        'onSelect-asset': onSelectAsset
      })

      const item = screen.getByRole('button', {
        name: 'image.png - image asset'
      })
      item.focus()
      expect(item).toHaveFocus()

      await user.keyboard(keys)

      expect(onSelectAsset).not.toHaveBeenCalled()
    })
  }

  it('does not select an asset when Enter activates its actions button', async () => {
    const user = userEvent.setup()
    const imageAsset = {
      ...buildAsset('image-asset-actions', 'image.png'),
      user_metadata: {}
    } satisfies AssetItem
    const onSelectAsset = vi.fn()

    renderListView([buildOutputItem(imageAsset)], {
      selectableAssets: [imageAsset],
      'onSelect-asset': onSelectAsset
    })

    const item = screen.getByRole('button', {
      name: 'image.png - image asset'
    })
    await user.hover(item)

    const actionsButton = await screen.findByRole('button', {
      name: 'More options'
    })
    actionsButton.focus()
    expect(actionsButton).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onSelectAsset).not.toHaveBeenCalled()
  })
})
