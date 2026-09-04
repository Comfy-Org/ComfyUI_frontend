import { fromPartial } from '@total-typescript/shoehorn'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'

const { downloadAssets } = vi.hoisted(() => ({
  downloadAssets: vi.fn()
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ isAssetDeleting: () => false })
}))

vi.mock('../composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => ({ downloadAssets })
}))

const asset: AssetItem = fromPartial({
  id: 'a',
  name: 'a.png',
  tags: ['input'],
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
  container.querySelector('[data-asset-id]')!.dispatchEvent(event)
  return { event, add }
}

describe('MediaAssetCard', () => {
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

    it.for([
      { name: 'photo.png', display_name: 'Photo', mime: 'image' },
      { name: 'clip.mp4', display_name: 'Clip', mime: 'video' }
    ])(
      'includes trusted metadata for an imported $mime card',
      ({ name, display_name }) => {
        const attachmentRef = `stored-${name}`
        const previewUrl = new URL(
          `/api/view?filename=${name}`,
          location.href
        ).toString()
        const { container } = renderCard({
          asset: fromPartial({
            id: name,
            name,
            hash: attachmentRef,
            display_name,
            tags: ['input'],
            preview_url: `/api/view?filename=${name}`
          })
        })

        const { event, add } = dispatchDragStart(container)

        expect(event.defaultPrevented).toBe(false)
        expect(add).toHaveBeenCalledWith(
          JSON.stringify({
            filename: name,
            type: 'input',
            display_name,
            attachment_ref: attachmentRef,
            media_kind: name.endsWith('.png') ? 'image' : 'video',
            preview_url: name.endsWith('.png') ? previewUrl : undefined
          }),
          MIME_ASSET_INFO
        )
        expect(add).toHaveBeenCalledWith(
          expect.stringContaining(`/api/view?filename=${name}`),
          'text/uri-list'
        )
      }
    )

    it('preserves generated-output metadata instead of replacing it with card fallbacks', () => {
      const { container } = renderCard({
        asset: fromPartial({
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
      })

      const { add } = dispatchDragStart(container)

      expect(add).toHaveBeenCalledWith(
        JSON.stringify({
          filename: 'generated.png',
          subfolder: 'outputs',
          type: 'output',
          display_name: 'Generated image',
          attachment_ref: 'card-name.png',
          media_kind: 'image',
          preview_url: new URL('/api/preview.png', location.href).toString()
        }),
        MIME_ASSET_INFO
      )
    })

    it('uses the asset content URL when an imported card has no preview URL', () => {
      const { container } = renderCard({
        asset: fromPartial({
          id: 'plain-video',
          name: 'plain_video.mp4',
          tags: ['input']
        })
      })

      const { add } = dispatchDragStart(container)

      expect(add).toHaveBeenCalledWith(
        JSON.stringify({
          filename: 'plain_video.mp4',
          type: 'input',
          display_name: undefined,
          attachment_ref: 'plain_video.mp4',
          media_kind: 'video'
        }),
        MIME_ASSET_INFO
      )
      expect(add).toHaveBeenCalledWith(
        expect.stringContaining('/assets/plain-video/content'),
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

  it.for([
    { modifier: 'Shift', keyDown: '{Shift>}', keyUp: '{/Shift}' },
    { modifier: 'Ctrl', keyDown: '{Control>}', keyUp: '{/Control}' },
    { modifier: 'Meta', keyDown: '{Meta>}', keyUp: '{/Meta}' }
  ])(
    '$modifier-clicks a video preview to select without starting playback',
    async ({ keyDown, keyUp }) => {
      const user = userEvent.setup()
      const { container, emitted } = renderCard({
        loading: false,
        asset: { ...asset, name: 'clip.mp4' }
      })
      const video = await vi.waitFor(() => {
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
        const element = container.querySelector('video')
        expect(element).toBeInTheDocument()
        return element!
      })
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
    const { container } = renderCard({
      loading: false,
      asset: { ...asset, name: 'clip.mp4' },
      showNativeVideoControls: false
    })
    const video = await vi.waitFor(() => {
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
      const element = container.querySelector('video')
      expect(element).toBeInTheDocument()
      return element!
    })
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})

    Object.defineProperty(video, 'paused', {
      value: false,
      configurable: true
    })

    await fireEvent.play(video)
    // eslint-disable-next-line testing-library/no-node-access -- the video hover target has no role
    const hoverTarget = video.parentElement!
    await user.hover(hoverTarget)

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
    const { container } = renderCard({
      loading: false,
      asset: { ...asset, name: 'clip.mp4' },
      showNativeVideoControls: false
    })
    const video = await vi.waitFor(() => {
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
      const element = container.querySelector('video')
      expect(element).toBeInTheDocument()
      return element!
    })

    // eslint-disable-next-line testing-library/no-node-access -- the video hover target has no role
    const hoverTarget = video.parentElement!
    const selectionControl = screen.getByRole('button', {
      name: 'assetBrowser.ariaLabel.assetCard'
    })
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
