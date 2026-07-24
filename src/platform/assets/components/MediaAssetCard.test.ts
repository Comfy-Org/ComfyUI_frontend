import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

const { downloadAssets } = vi.hoisted(() => ({
  downloadAssets: vi.fn()
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ isAssetDeleting: () => false })
}))

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({ downloadAssets })
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
        LoadingOverlay: true,
        MediaTitle: true
      },
      directives: { tooltip: {} }
    }
  })
}

function dispatchDragStart(
  container: Element,
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
  // eslint-disable-next-line testing-library/no-node-access -- the draggable card intentionally has no interactive role
  container.querySelector('[data-asset-id="a"]')!.dispatchEvent(event)
  return { event, add }
}

describe('MediaAssetCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('dragStart', () => {
    it('cancels the native drag when Ctrl is held so a marquee can start over the card', () => {
      const { container } = renderCard()

      const { event, add } = dispatchDragStart(container, { ctrlKey: true })

      expect(event.defaultPrevented).toBe(true)
      expect(add).not.toHaveBeenCalled()
    })

    it('cancels the native drag when Meta is held', () => {
      const { container } = renderCard()

      const { event } = dispatchDragStart(container, { metaKey: true })

      expect(event.defaultPrevented).toBe(true)
    })

    it('includes the asset metadata with display_name in the drag payload', () => {
      const { container } = renderCard()

      const { event, add } = dispatchDragStart(container)

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

  it('keeps download and more actions independent from selection', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard({ loading: false, selected: true })

    await user.click(
      screen.getByRole('button', { name: 'mediaAsset.actions.download' })
    )

    expect(downloadAssets).toHaveBeenCalledWith([asset])
    expect(emitted().select).toBeUndefined()
    expect(emitted()['toggle-selection']).toBeUndefined()

    await user.click(
      screen.getByRole('button', { name: 'mediaAsset.actions.moreOptions' })
    )
    expect(emitted()['context-menu']).toHaveLength(1)
    expect(emitted().select).toBeUndefined()
    expect(emitted()['toggle-selection']).toBeUndefined()
  })

  it('selects the asset from the image preview and inspects it on double click', async () => {
    const user = userEvent.setup()
    const { container, emitted } = renderCard({
      loading: false,
      selected: true
    })
    const preview = await screen.findByRole('img', { name: 'a.png' })
    const outsideClick = vi.fn()
    // eslint-disable-next-line testing-library/no-container -- verifies the card's event boundary against its rendered parent
    container.addEventListener('click', outsideClick)

    await user.click(preview)
    expect(emitted().select).toHaveLength(1)
    expect(emitted()['toggle-selection']).toBeUndefined()
    expect(outsideClick).not.toHaveBeenCalled()

    await user.dblClick(preview)
    expect(emitted().select).toHaveLength(3)
    expect(emitted().zoom).toEqual([[asset]])
  })

  it('selects non-video assets from the preview', async () => {
    const user = userEvent.setup()
    const { container, emitted } = renderCard({
      loading: false,
      asset: { ...asset, name: 'model.glb' }
    })
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifies the preview event boundary independently of its async media component
    const preview = container.querySelector('.aspect-square')!

    await user.click(preview)

    expect(emitted().select).toHaveLength(1)
    expect(emitted().zoom).toBeUndefined()
  })

  it('selects the asset from the info area or selection control', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard({ loading: false })

    await user.click(screen.getByText('PNG'))
    expect(emitted().select).toHaveLength(1)

    await user.click(
      screen.getByRole('button', {
        name: 'assetBrowser.ariaLabel.assetCard'
      })
    )
    expect(emitted()['toggle-selection']).toHaveLength(1)
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
