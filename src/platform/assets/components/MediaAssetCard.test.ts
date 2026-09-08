import { fromPartial } from '@total-typescript/shoehorn'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'

const { downloadAssets, isAssetDeleting } = vi.hoisted(() => ({
  downloadAssets: vi.fn(),
  isAssetDeleting: vi.fn(() => false)
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ isAssetDeleting })
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

const asset: AssetItem = fromPartial({
  id: 'a',
  name: 'a.png',
  tags: [],
  preview_url: '/preview.png'
})

function renderCard(
  props: Partial<ComponentProps<typeof MediaAssetCard>> = {}
) {
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
  screen.getByTestId('media-asset-card').dispatchEvent(event)
  return { event, add }
}

describe('MediaAssetCard', () => {
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
      expect(add).toHaveBeenNthCalledWith(
        1,
        JSON.stringify({
          filename: 'a.png',
          subfolder: '',
          type: 'output',
          display_name: 'Display A',
          // The agent composer resolves an attachment from these three.
          attachment_ref: 'a.png',
          media_kind: 'image',
          preview_url: 'http://localhost:3000/api/preview.png'
        }),
        MIME_ASSET_INFO
      )
    })

    it('offers the preview URL as a uri-list flavour for external drop targets', () => {
      renderCard()

      const { add } = dispatchDragStart()

      expect(add).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3000/api/preview.png',
        'text/uri-list'
      )
    })
  })

  it('keeps download and more actions independent from selection', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard({ loading: false, selected: true })

    await user.hover(await screen.findByRole('img', { name: 'a.png' }))

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
    const { emitted } = renderCard({
      loading: false,
      selected: true
    })
    const preview = await screen.findByRole('img', { name: 'a.png' })
    const outsideClick = vi.fn()
    window.addEventListener('click', outsideClick)

    await user.click(preview)
    expect(emitted().select).toHaveLength(1)
    expect(emitted()['toggle-selection']).toBeUndefined()
    expect(outsideClick).not.toHaveBeenCalled()

    await user.dblClick(preview)
    expect(emitted().select).toHaveLength(3)
    expect(emitted().zoom).toEqual([[asset]])
    window.removeEventListener('click', outsideClick)
  })

  it('selects non-video assets from the preview', async () => {
    const user = userEvent.setup()
    const { emitted } = renderCard({
      loading: false,
      asset: { ...asset, name: 'model.glb' }
    })
    const preview = screen.getByTestId('media-asset-preview')

    await user.click(preview)

    expect(emitted().select).toHaveLength(1)
    expect(emitted().zoom).toBeUndefined()
  })

  it.for([
    { modifier: 'Shift', keyDown: '{Shift>}', keyUp: '{/Shift}' },
    { modifier: 'Ctrl', keyDown: '{Control>}', keyUp: '{/Control}' },
    { modifier: 'Meta', keyDown: '{Meta>}', keyUp: '{/Meta}' }
  ])(
    '$modifier-clicks a video preview to select without starting playback',
    async ({ keyDown, keyUp }) => {
      const user = userEvent.setup()
      const { emitted } = renderCard({
        loading: false,
        asset: { ...asset, name: 'clip.mp4' }
      })
      const video = await screen.findByLabelText<HTMLVideoElement>('clip.mp4')
      const playSpy = vi
        .spyOn(video, 'play')
        .mockImplementation(() => Promise.resolve())

      Object.defineProperty(video, 'paused', {
        value: true,
        configurable: true
      })

      await user.keyboard(keyDown)
      await user.click(video)
      await user.keyboard(keyUp)

      expect(playSpy).not.toHaveBeenCalled()
      expect(emitted().select).toHaveLength(1)
    }
  )

  it('disables native controls for compact video cards', async () => {
    const user = userEvent.setup()
    renderCard({
      loading: false,
      asset: { ...asset, name: 'clip.mp4' },
      showNativeVideoControls: false
    })
    const video = await screen.findByLabelText<HTMLVideoElement>('clip.mp4')
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})

    Object.defineProperty(video, 'paused', {
      value: false,
      configurable: true
    })

    await fireEvent.play(video)
    await user.hover(screen.getByTestId('media-video'))

    expect(video.controls).toBe(false)
    expect(
      screen.getByRole('button', { name: 'mediaAsset.actions.download' })
    ).toBeInTheDocument()

    await user.click(video)
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    await fireEvent.pause(video)
  })

  it('preserves action focus when the pointer leaves a playing compact video', async () => {
    const user = userEvent.setup()
    renderCard({
      loading: false,
      asset: { ...asset, name: 'clip.mp4' },
      showNativeVideoControls: false
    })
    const video = await screen.findByLabelText<HTMLVideoElement>('clip.mp4')

    const hoverTarget = screen.getByTestId('media-video')
    const selectionControl = screen.getByRole('button', {
      name: 'assetBrowser.ariaLabel.assetCard'
    })
    await user.tab()
    expect(screen.getByRole('button', { name: 'g.play' })).toHaveFocus()
    await user.tab()
    expect(selectionControl).toHaveFocus()
    await user.tab()
    const downloadButton = screen.getByRole('button', {
      name: 'mediaAsset.actions.download'
    })
    expect(downloadButton).toHaveFocus()

    await user.hover(hoverTarget)
    await fireEvent.play(video)
    await user.unhover(hoverTarget)

    expect(downloadButton).toHaveFocus()
  })

  it('removes the preview area from the tab order while the asset is deleting', () => {
    isAssetDeleting.mockReturnValue(true)
    renderCard({ loading: false })

    expect(screen.getByTestId('media-asset-preview')).toHaveAttribute('inert')
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

  it('does not let the hidden selection control intercept pointer input', () => {
    renderCard({ loading: false })

    const selectionControl = screen.getByRole('button', {
      name: 'assetBrowser.ariaLabel.assetCard'
    })
    expect(selectionControl).toHaveClass(
      'pointer-events-none',
      'group-hover:pointer-events-auto',
      'focus-visible:pointer-events-auto'
    )
  })

  it('preserves card action tab order after a pointer interaction', async () => {
    const user = userEvent.setup()
    renderCard({ loading: false })

    const selectionControl = screen.getByRole('button', {
      name: 'assetBrowser.ariaLabel.assetCard'
    })
    await user.click(selectionControl)
    await user.unhover(selectionControl)

    expect(selectionControl).toHaveFocus()

    await user.tab()

    expect(
      screen.getByRole('button', { name: 'mediaAsset.actions.download' })
    ).toHaveFocus()
  })

  it('keeps card actions visible while keyboard focus is within the card', async () => {
    const user = userEvent.setup()
    renderCard({ loading: false })

    const selectionControl = screen.getByRole('button', {
      name: 'assetBrowser.ariaLabel.assetCard'
    })
    await user.tab()

    expect(selectionControl).toHaveFocus()

    const downloadButton = screen.getByRole('button', {
      name: 'mediaAsset.actions.download'
    })
    expect(downloadButton).toBeInTheDocument()

    await user.tab()

    expect(downloadButton).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'mediaAsset.actions.moreOptions' })
    ).toBeInTheDocument()
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
