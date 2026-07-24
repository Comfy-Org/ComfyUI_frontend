import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ isAssetDeleting: () => false })
}))

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({ downloadAssets: vi.fn() })
}))

vi.mock('@/platform/assets/schemas/assetMetadataSchema', () => ({
  getOutputAssetMetadata: () => ({
    allOutputs: [
      {
        filename: 'a.png',
        subfolder: '',
        type: 'output',
        display_name: 'Display A'
      }
    ]
  })
}))

const asset: AssetItem = {
  id: 'a',
  name: 'a.png',
  tags: [],
  preview_url: '/preview.png'
}

function renderCard(
  props: Partial<ComponentProps<typeof MediaAssetCard>> = {}
) {
  setActivePinia(createTestingPinia({ stubActions: false }))
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false
  })
  return render(MediaAssetCard, {
    props: { asset, loading: true, ...props },
    global: {
      plugins: [i18n],
      stubs: {
        IconGroup: true,
        LoadingOverlay: true,
        Button: true,
        MediaTitle: true
      },
      directives: { tooltip: {} }
    }
  })
}

function dispatchDragStart(
  init: { ctrlKey?: boolean; metaKey?: boolean } = {}
) {
  const dataTransfer = new DataTransfer()
  const add = vi.spyOn(dataTransfer.items, 'add').mockImplementation(() => null)
  const event = new DragEvent('dragstart', { bubbles: true, cancelable: true })
  // happy-dom's DragEvent ignores dataTransfer/modifier init, so set them here.
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer, configurable: true },
    ctrlKey: { value: init.ctrlKey ?? false, configurable: true },
    metaKey: { value: init.metaKey ?? false, configurable: true }
  })
  screen.getByRole('button').dispatchEvent(event)
  return { event, add }
}

describe('MediaAssetCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('dragStart', () => {
    it('cancels the native drag when Ctrl is held so a marquee can start over the card', () => {
      renderCard()

      const { event, add } = dispatchDragStart({ ctrlKey: true })

      expect(event.defaultPrevented).toBe(true)
      expect(add).not.toHaveBeenCalled()
    })

    it('cancels the native drag when Meta is held', () => {
      renderCard()

      const { event } = dispatchDragStart({ metaKey: true })

      expect(event.defaultPrevented).toBe(true)
    })

    it('includes the asset metadata with display_name in the drag payload', () => {
      renderCard()

      const { event, add } = dispatchDragStart()

      expect(event.defaultPrevented).toBe(false)
      expect(add).toHaveBeenCalledWith(
        JSON.stringify({
          filename: 'a.png',
          subfolder: '',
          type: 'output',
          display_name: 'Display A'
        }),
        expect.any(String)
      )
    })
  })

  it('shows image format and dimensions without file size', () => {
    renderCard({
      loading: false,
      asset: {
        ...asset,
        size: 1048576,
        metadata: { width: 1024, height: 768 },
        user_metadata: { executionTimeInSeconds: 1.25 }
      }
    })

    expect(screen.getByText('1.25s')).toBeInTheDocument()
    expect(screen.getByText('PNG 1024x768')).toBeInTheDocument()
    expect(screen.queryByText(/MB/)).not.toBeInTheDocument()
  })

  it('shows format and file size for non-image assets', () => {
    renderCard({
      loading: false,
      asset: {
        ...asset,
        name: 'clip.mp4',
        size: 1048576
      }
    })

    expect(screen.getByText(/^MP4 .*MB$/)).toBeInTheDocument()
  })
})
