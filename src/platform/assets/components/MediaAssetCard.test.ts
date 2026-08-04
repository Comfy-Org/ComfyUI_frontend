import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ isAssetDeleting: () => false })
}))

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({ downloadAssets: vi.fn() })
}))

const asset: AssetItem = {
  id: 'a',
  name: 'a.png',
  tags: ['input'],
  preview_url: '/preview.png'
}

function renderCard(cardAsset: AssetItem = asset) {
  setActivePinia(createTestingPinia({ stubActions: false }))
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false
  })
  return render(MediaAssetCard, {
    props: { asset: cardAsset, loading: true },
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
  screen
    .getByRole('button', { name: 'assetBrowser.ariaLabel.assetCard' })
    .dispatchEvent(event)
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

    it.for([
      { name: 'photo.png', display_name: 'Photo', mime: 'image' },
      { name: 'clip.mp4', display_name: 'Clip', mime: 'video' }
    ])(
      'includes trusted metadata for an imported $mime card',
      ({ name, display_name }) => {
        renderCard({
          id: name,
          name,
          display_name,
          tags: ['input'],
          preview_url: `/api/view?filename=${name}`
        })

        const { event, add } = dispatchDragStart()

        expect(event.defaultPrevented).toBe(false)
        expect(add).toHaveBeenCalledWith(
          JSON.stringify({ filename: name, type: 'input', display_name }),
          MIME_ASSET_INFO
        )
        expect(add).toHaveBeenCalledWith(
          expect.stringContaining(`/api/view?filename=${name}`),
          'text/uri-list'
        )
      }
    )

    it('preserves generated-output metadata instead of replacing it with card fallbacks', () => {
      renderCard({
        id: 'job-1',
        name: 'card-name.png',
        display_name: 'Card name',
        tags: ['output'],
        preview_url: '/preview.png',
        user_metadata: {
          jobId: 'job-1',
          nodeId: '9',
          subfolder: '',
          allOutputs: [
            {
              filename: 'generated.png',
              subfolder: 'outputs',
              type: 'output',
              display_name: 'Generated image'
            }
          ]
        }
      })

      const { add } = dispatchDragStart()

      expect(add).toHaveBeenCalledWith(
        JSON.stringify({
          filename: 'generated.png',
          subfolder: 'outputs',
          type: 'output',
          display_name: 'Generated image'
        }),
        MIME_ASSET_INFO
      )
    })

    it('uses the asset content URL when an imported card has no preview URL', () => {
      renderCard({
        id: 'plain-video',
        name: 'plain_video.mp4',
        tags: ['input']
      })

      const { add } = dispatchDragStart()

      expect(add).toHaveBeenCalledWith(
        JSON.stringify({
          filename: 'plain_video.mp4',
          type: 'input',
          display_name: undefined
        }),
        MIME_ASSET_INFO
      )
      expect(add).toHaveBeenCalledWith(
        expect.stringContaining('/assets/plain-video/content'),
        'text/uri-list'
      )
    })
  })
})
