import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import { unflattenOutputAssets } from '@/platform/assets/composables/media/assetMappers'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { useAssetsStore } from '@/stores/assetsStore'

const { downloadAssets } = vi.hoisted(() => ({
  downloadAssets: vi.fn()
}))

vi.mock<unknown>(import('../composables/useMediaAssetActions'), () => ({
  useMediaAssetActions: () => ({ downloadAssets })
}))

vi.mock(import('@/composables/useFeatureFlags'))

const asset: AssetItem = fromPartial({
  id: 'a',
  name: 'a.png',
  tags: [],
  preview_url: '/preview.png',
  user_metadata: {
    jobId: 'job-a',
    subfolder: '',
    allOutputs: [
      {
        filename: 'a.png',
        subfolder: '',
        type: 'output',
        display_name: 'Display A'
      }
    ]
  }
})

function groupByJob(flatAsset: AssetItem): AssetItem {
  const [grouped] = unflattenOutputAssets([flatAsset])
  assert.exists(grouped)
  return grouped
}

const videoAssetId = '11111111-1111-4111-a111-111111111111'
const imageAssetId = '33333333-3333-4333-a333-333333333333'

const jobGroupedVideo = groupByJob(
  fromPartial({
    id: videoAssetId,
    job_id: '22222222-2222-4222-a222-222222222222',
    name: 'agent_generated_video.mp4',
    tags: ['output'],
    created_at: '2026-09-18T00:00:00.000Z'
  })
)

const jobGroupedImage = groupByJob(
  fromPartial({
    id: imageAssetId,
    job_id: '44444444-4444-4444-a444-444444444444',
    name: 'c6cadcee57dd.png',
    tags: ['output'],
    created_at: '2026-09-18T00:00:00.000Z',
    preview_url: '/api/view?filename=c6cadcee57dd.png'
  })
)

const modelWithThumbnail: AssetItem = fromPartial({
  id: 'model',
  name: 'model.glb',
  tags: ['output'],
  preview_id: 'model-thumbnail'
})

const historyImage: AssetItem = fromPartial({
  id: 'history-job',
  name: 'a.png',
  tags: ['output'],
  preview_url: '/api/view?filename=a.png&type=output&subfolder='
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
        MediaTitle: true
      },
      directives: { tooltip: {} }
    }
  })
}

function dispatchDragStart(
  container: Element,
  init: { ctrlKey?: boolean; metaKey?: boolean; assetId?: string } = {}
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
  const cardSelector = `[data-asset-id="${init.assetId ?? 'a'}"]`
  // eslint-disable-next-line testing-library/no-node-access -- the draggable card intentionally has no interactive role
  container.querySelector(cardSelector)!.dispatchEvent(event)
  return { event, add }
}

beforeEach(() => {
  vi.mocked(useAssetsStore().isAssetDeleting).mockImplementation(() => false)
})

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

    it('includes the asset metadata with display_name in the drag payload', () => {
      const { container } = renderCard()

      const { event, add } = dispatchDragStart(container)

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

    it.for([
      {
        kind: 'a job-grouped image with a self-preview',
        assetsEnabled: true,
        item: jobGroupedImage,
        fileUrl: `http://localhost:3000/api/assets/${imageAssetId}/content`
      },
      {
        kind: 'a job-grouped video with no preview',
        assetsEnabled: true,
        item: jobGroupedVideo,
        fileUrl: `http://localhost:3000/api/assets/${videoAssetId}/content`
      },
      {
        kind: 'a 3D model with a persisted thumbnail',
        assetsEnabled: true,
        item: modelWithThumbnail,
        fileUrl: 'http://localhost:3000/api/assets/model/content'
      },
      {
        kind: 'a history-backed image with the assets API off',
        assetsEnabled: false,
        item: historyImage,
        fileUrl:
          'http://localhost:3000/api/view?filename=a.png&type=output&subfolder='
      }
    ])(
      'offers the file URL, not the preview, as the uri-list flavour for $kind',
      ({ assetsEnabled, item, fileUrl }) => {
        vi.mocked(useFeatureFlags().flags).assetsEnabled = assetsEnabled
        const { container } = renderCard({ asset: item })

        const { add } = dispatchDragStart(container, { assetId: item.id })

        expect(add).toHaveBeenCalledWith(fileUrl, 'text/uri-list')
      }
    )
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

  it.for([
    {
      kind: 'video',
      name: 'agent_generated_video.mp4',
      testId: 'media-asset-video'
    },
    {
      kind: 'audio',
      name: 'agent_generated_audio.mp3',
      testId: 'wave-audio-media'
    }
  ])(
    'plays a $kind asset with no server preview from its inline content url',
    async ({ name, testId }) => {
      vi.mocked(useFeatureFlags().flags).assetsEnabled = true

      renderCard({
        loading: false,
        asset: {
          ...asset,
          id: 'agent-media',
          name,
          preview_url: undefined,
          thumbnail_url: undefined
        }
      })

      const media = await screen.findByTestId(testId)

      expect(media).toHaveAttribute(
        'src',
        '/api/assets/agent-media/content?disposition=inline'
      )
    }
  )
})
