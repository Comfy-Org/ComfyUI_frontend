import { useAssetsStore } from '@/stores/assetsStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import MediaAssetCard from '@/platform/assets/components/MediaAssetCard.vue'
import '@/platform/assets/components/MediaAudioTop.vue'
import { unflattenOutputAssets } from '@/platform/assets/composables/media/assetMappers'
import { useAssetGridSelection } from '@/platform/assets/composables/useAssetGridSelection'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import { provideWebSessionRequests } from '@comfyorg/api-client/webSessionFetch'
import type { WebSessionRequests } from '@comfyorg/api-client/webSessionFetch'

const mockIsCloud = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/platform/assets/composables/useMediaAssetActions'))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
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

function cardGlobalConfig() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false
  })
  return {
    plugins: [i18n],
    stubs: {
      MediaTitle: true
    }
  }
}

function renderCard(
  props: Partial<ComponentProps<typeof MediaAssetCard>> = {}
) {
  return render(MediaAssetCard, {
    props: { asset, loading: true, ...props },
    global: cardGlobalConfig()
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
  // oxlint-disable-next-line testing-library/no-node-access -- the draggable card intentionally has no interactive role
  container.querySelector(cardSelector)!.dispatchEvent(event)
  return { event, add }
}

beforeEach(() => {
  vi.mocked(useAssetsStore().isAssetDeleting).mockImplementation(() => false)
  mockIsCloud.value = false
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

    expect(useMediaAssetActions().downloadAssets).toHaveBeenCalledWith([asset])
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
    // oxlint-disable-next-line testing-library/no-container -- verifies the card's event boundary against its rendered parent
    container.addEventListener('click', outsideClick)

    await user.click(preview)
    expect(emitted().select).toHaveLength(1)
    expect(emitted()['toggle-selection']).toBeUndefined()
    expect(outsideClick).not.toHaveBeenCalled()

    await user.dblClick(preview)
    expect(emitted().select).toHaveLength(3)
    expect(emitted().zoom).toEqual([[asset]])
  })

  it('previews an exr asset from its preview_url', async () => {
    const previewUrl = '/api/assets/exr-preview/content'
    renderCard({
      loading: false,
      asset: { ...asset, name: 'render.exr', preview_url: previewUrl }
    })

    expect(
      await screen.findByRole('img', { name: 'render.exr' })
    ).toHaveAttribute('src', previewUrl)
  })

  it('inspects an HDR asset on double click', async () => {
    const user = userEvent.setup()
    const hdrAsset = {
      ...asset,
      name: 'sky.exr',
      preview_url: '/api/assets/sky-preview/content'
    }
    const { emitted } = renderCard({ loading: false, asset: hdrAsset })
    const preview = await screen.findByRole('img', { name: 'sky.exr' })

    await user.dblClick(preview)

    expect(emitted().zoom).toEqual([[hdrAsset]])
  })

  it('selects non-video assets from the preview', async () => {
    const user = userEvent.setup()
    const { container, emitted } = renderCard({
      loading: false,
      asset: { ...asset, name: 'model.glb' }
    })
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifies the preview event boundary independently of its async media component
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
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
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

  it('names the web-session workspace on an image preview served by the assets API', async () => {
    const release = provideWebSessionRequests(
      fromPartial<WebSessionRequests>({ workspaceId: () => 'ws-1' })
    )
    try {
      renderCard({
        loading: false,
        asset: {
          ...asset,
          name: 'a.png',
          thumbnail_url: '/api/assets/img-id/content'
        }
      })

      expect(await screen.findByRole('img', { name: 'a.png' })).toHaveAttribute(
        'src',
        '/api/assets/img-id/content?workspace_id=ws-1'
      )
    } finally {
      release()
    }
  })

  it('names the web-session workspace on a video preview served by the assets API', async () => {
    const release = provideWebSessionRequests(
      fromPartial<WebSessionRequests>({ workspaceId: () => 'ws-1' })
    )
    try {
      const { container } = renderCard({
        loading: false,
        asset: {
          ...asset,
          name: 'clip.mp4',
          preview_url: '/api/assets/clip-id/content'
        }
      })
      const video = await vi.waitFor(() => {
        // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
        const element = container.querySelector('video')
        expect(element).toBeInTheDocument()
        return element!
      })

      expect(video).toHaveAttribute(
        'src',
        '/api/assets/clip-id/content?workspace_id=ws-1'
      )
    } finally {
      release()
    }
  })

  describe('audio player strip', () => {
    const audioAsset: AssetItem = { ...asset, name: 'track.mp3' }
    const waveformWidth = 100
    const selectionModifiers = [
      { modifier: 'Shift', keyDown: '{Shift>}', keyUp: '{/Shift}' },
      { modifier: 'Ctrl', keyDown: '{Control>}', keyUp: '{/Control}' },
      { modifier: 'Meta', keyDown: '{Meta>}', keyUp: '{/Meta}' }
    ]

    async function prepareAudioStrip() {
      const audio = await screen.findByTestId('wave-audio-media')
      assert.instanceOf(audio, HTMLAudioElement)
      Object.defineProperty(audio, 'duration', {
        value: 10,
        configurable: true
      })
      await fireEvent(audio, new Event('durationchange'))
      const waveform = screen.getByTestId('wave-audio-waveform')
      waveform.getBoundingClientRect = () =>
        new DOMRect(0, 0, waveformWidth, 32)
      return {
        waveform,
        playButton: screen.getByRole('button', { name: 'g.play' }),
        playSpy: vi.spyOn(audio, 'play').mockResolvedValue()
      }
    }

    async function renderAudioCard() {
      const rendered = renderCard({ loading: false, asset: audioAsset })
      return { ...rendered, ...(await prepareAudioStrip()) }
    }

    async function renderAudioCardInSelectionGrid() {
      const SelectionGrid = defineComponent({
        components: { MediaAssetCard },
        setup() {
          const gridRef = ref<HTMLElement>()
          const { marqueeStyle } = useAssetGridSelection({
            marqueeContainerRef: gridRef,
            hoverTargetRef: gridRef,
            getAssets: () => [audioAsset],
            getSelectedIds: () => [],
            setSelectedIds: vi.fn(),
            selectAll: vi.fn()
          })
          return { gridRef, marqueeStyle, audioAsset }
        },
        template: `
          <div ref="gridRef">
            <MediaAssetCard :asset="audioAsset" :loading="false" />
            <div v-if="marqueeStyle" data-testid="marquee" :style="marqueeStyle" />
          </div>
        `
      })
      render(SelectionGrid, { global: cardGlobalConfig() })
      return prepareAudioStrip()
    }

    async function dragAcross(
      user: ReturnType<typeof userEvent.setup>,
      target: HTMLElement
    ) {
      await user.pointer([
        { keys: '[MouseLeft>]', target, coords: { clientX: 10, clientY: 10 } },
        { target, coords: { clientX: 30, clientY: 20 } }
      ])
    }

    it.for(selectionModifiers)(
      '$modifier-clicks the waveform to select without seeking',
      async ({ keyDown, keyUp }) => {
        const user = userEvent.setup()
        const { emitted, waveform, playSpy } = await renderAudioCard()

        await user.keyboard(keyDown)
        await user.pointer({
          keys: '[MouseLeft]',
          target: waveform,
          coords: { clientX: waveformWidth / 2, clientY: 16 }
        })
        await user.keyboard(keyUp)

        expect(emitted().select).toHaveLength(1)
        expect(playSpy).not.toHaveBeenCalled()
        expect(screen.getByText('0:00 / 0:10')).toBeInTheDocument()
      }
    )

    it.for(selectionModifiers.filter(({ modifier }) => modifier !== 'Shift'))(
      'starts a marquee from a $modifier drag on the waveform',
      async ({ keyDown, keyUp }) => {
        const user = userEvent.setup()
        const { waveform } = await renderAudioCardInSelectionGrid()

        await user.keyboard(keyDown)
        await dragAcross(user, waveform)

        expect(screen.getByTestId('marquee')).toBeInTheDocument()

        await user.pointer({ keys: '[/MouseLeft]', target: waveform })
        await user.keyboard(keyUp)
      }
    )

    it('does not start a marquee from a plain drag on the waveform', async () => {
      const user = userEvent.setup()
      const { waveform } = await renderAudioCardInSelectionGrid()

      await dragAcross(user, waveform)

      expect(screen.queryByTestId('marquee')).not.toBeInTheDocument()
    })

    it('seeks without selecting from a plain click on the waveform', async () => {
      const user = userEvent.setup()
      const { emitted, waveform, playSpy } = await renderAudioCard()

      await user.pointer({
        keys: '[MouseLeft]',
        target: waveform,
        coords: { clientX: waveformWidth / 2, clientY: 16 }
      })

      expect(screen.getByText('0:05 / 0:10')).toBeInTheDocument()
      expect(playSpy).toHaveBeenCalled()
      expect(emitted().select).toBeUndefined()
      expect(emitted()['toggle-selection']).toBeUndefined()
    })

    it('toggles playback without selecting from a plain click on play', async () => {
      const user = userEvent.setup()
      const { emitted, playButton, playSpy } = await renderAudioCard()

      await user.click(playButton)

      expect(playSpy).toHaveBeenCalledTimes(1)
      expect(emitted().select).toBeUndefined()
    })

    it.for(selectionModifiers)(
      '$modifier-clicks play to select without toggling playback',
      async ({ keyDown, keyUp }) => {
        const user = userEvent.setup()
        const { emitted, playButton, playSpy } = await renderAudioCard()

        await user.keyboard(keyDown)
        await user.click(playButton)
        await user.keyboard(keyUp)

        expect(emitted().select).toHaveLength(1)
        expect(playSpy).not.toHaveBeenCalled()
      }
    )
  })

  it('disables native controls for compact video cards', async () => {
    const user = userEvent.setup()
    const { container } = renderCard({
      loading: false,
      asset: { ...asset, name: 'clip.mp4' },
      showNativeVideoControls: false
    })
    const video = await vi.waitFor(() => {
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
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
    // oxlint-disable-next-line testing-library/no-node-access -- the video hover target has no role
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
      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
      const element = container.querySelector('video')
      expect(element).toBeInTheDocument()
      return element!
    })

    // oxlint-disable-next-line testing-library/no-node-access -- the video hover target has no role
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

  it.for([
    {
      kind: 'video',
      name: 'cloud_video.mp4',
      testId: 'media-asset-video'
    },
    {
      kind: 'audio',
      name: 'cloud_audio.mp3',
      testId: 'wave-audio-media'
    }
  ])(
    'plays a hashed $kind asset on cloud from a cookie-compatible /view url',
    async ({ name, testId }) => {
      mockIsCloud.value = true
      vi.mocked(useFeatureFlags().flags).assetsEnabled = true

      renderCard({
        loading: false,
        asset: {
          ...asset,
          id: 'cloud-media',
          name,
          hash: 'abc123.mp4',
          tags: ['output'],
          preview_url: undefined,
          thumbnail_url: undefined
        }
      })

      const src = (await screen.findByTestId(testId)).getAttribute('src')
      const url = new URL(src ?? '', 'http://localhost')

      expect(url.pathname).toBe('/api/view')
      expect(url.searchParams.get('filename')).toBe('abc123.mp4')
      expect(url.searchParams.get('type')).toBe('output')
      expect(src).not.toContain('/content')
    }
  )

  it('falls back to the inline content url on cloud when the asset has no hash', async () => {
    mockIsCloud.value = true
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true

    renderCard({
      loading: false,
      asset: {
        ...asset,
        id: 'no-hash',
        name: 'clip.mp4',
        hash: undefined,
        preview_url: undefined,
        thumbnail_url: undefined
      }
    })

    expect(await screen.findByTestId('media-asset-video')).toHaveAttribute(
      'src',
      '/api/assets/no-hash/content?disposition=inline'
    )
  })
})
