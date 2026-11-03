import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelThumbnailResult } from '@/extensions/core/load3d/components/modelThumbnail'
import { i18n } from '@/i18n'
import { useDialogStore } from '@/stores/dialogStore'

import type { ReplyAsset } from '@/workbench/extensions/agent/utils/replyAssets'
import ReplyAssetGroup from './ReplyAssetGroup.vue'

vi.mock(import('@/platform/assets/utils/assetPreviewUtil'), { spy: true })

import {
  findOutputAsset as findOutputAssetImplementation,
  findServerPreviewUrl as findServerPreviewUrlImplementation,
  isAssetPreviewSupported as isAssetPreviewSupportedImplementation
} from '@/platform/assets/utils/assetPreviewUtil'

const findOutputAsset = vi.mocked(findOutputAssetImplementation)
const findServerPreviewUrl = vi.mocked(findServerPreviewUrlImplementation)
const isAssetPreviewSupported = vi.mocked(isAssetPreviewSupportedImplementation)

const generateModelThumbnail = vi.hoisted(() =>
  vi.fn(
    async (
      _modelUrl: string,
      _assetName: string,
      _callerSignal?: AbortSignal
    ): Promise<ModelThumbnailResult> => ({ status: 'failed' })
  )
)
vi.mock(import('@/extensions/core/load3d/components/modelThumbnail'), () => ({
  generateModelThumbnail
}))

const image = (n: number): ReplyAsset => ({
  url: `https://x/i${n}.png`,
  filename: `i${n}.png`,
  kind: 'image'
})
const video: ReplyAsset = {
  url: 'https://x/clip.mp4',
  filename: 'clip.mp4',
  kind: 'video'
}
const audio: ReplyAsset = {
  url: 'https://x/song.mp3',
  filename: 'song.mp3',
  kind: 'audio'
}
const model: ReplyAsset = {
  url: 'https://x/api/view?filename=mesh.glb',
  filename: 'mesh.glb',
  kind: '3D'
}

function renderGroup(assets: ReplyAsset[]) {
  return render(ReplyAssetGroup, {
    props: { assets },
    global: {
      plugins: [i18n],
      stubs: {
        MediaLightbox: {
          props: ['allGalleryItems', 'activeIndex'],
          template:
            '<div data-testid="lightbox" :data-active="activeIndex" :data-count="allGalleryItems.length" />'
        },
        ReplyAudioCard: {
          props: ['asset', 'title'],
          template:
            '<div data-testid="audio-card" :data-title="title" :data-src="asset.url" />'
        }
      }
    }
  })
}

const thumbs = () =>
  screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label'))
const toggle = () => {
  const button = screen
    .getAllByRole('button')
    .find((candidate) => !candidate.getAttribute('aria-label'))
  if (!button) throw new Error('Expected the asset group toggle')
  return button
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let settle: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return {
    promise,
    resolve: (value) => {
      if (!settle) throw new Error('Deferred promise was not initialized')
      settle(value)
    }
  }
}

describe('ReplyAssetGroup', () => {
  beforeEach(() => {
    isAssetPreviewSupported.mockReturnValue(false)
    findServerPreviewUrl.mockResolvedValue(null)
    findOutputAsset.mockResolvedValue(undefined)
    generateModelThumbnail.mockResolvedValue({ status: 'failed' })
  })

  it('T-09 / PM-652 / FE-1326 renders image and video previews inline', () => {
    renderGroup([image(1), video])

    expect(screen.getByRole('img', { name: 'i1.png' })).toBeInTheDocument()
    expect(screen.getByTestId('reply-video-preview')).toBeInTheDocument()
  })

  it('marks video previews with a play affordance but leaves other tiles unmarked', () => {
    renderGroup([image(1), video, model])

    expect(screen.getAllByTestId('reply-video-affordance')).toHaveLength(1)
    expect(
      within(
        screen.getByRole('button', { name: 'Open video: clip.mp4' })
      ).getByTestId('reply-video-affordance')
    ).toBeInTheDocument()
  })

  it('PM-1895 announces a video name containing markup characters literally', () => {
    renderGroup([
      { ...video, url: 'https://x/a&b.mp4', filename: "a&b <Tom's>.mp4" },
      { ...image(1), url: 'https://x/a&b.png', filename: "a&b <Tom's>.png" }
    ])

    expect(
      screen.getByRole('button', { name: "Open video: a&b <Tom's>.mp4" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: "a&b <Tom's>.png" })
    ).toBeInTheDocument()
  })

  it('T-09 / PM-652 / FE-1326 opens inspect view at the clicked visual asset', async () => {
    renderGroup([image(1), video])

    await userEvent.click(
      screen.getByRole('button', { name: 'Open video: clip.mp4' })
    )

    const lightbox = screen.getByTestId('lightbox')
    expect(lightbox.dataset.active).toBe('1')
    expect(lightbox.dataset.count).toBe('2')
  })

  it('PM-1895 clears the play badge while the hover preview is playing', async () => {
    renderGroup([video, image(1)])
    const element = screen.getByTestId('reply-video-preview')

    await userEvent.hover(element)
    expect(screen.queryByTestId('reply-video-affordance')).toBeNull()

    await userEvent.unhover(element)
    expect(screen.getByTestId('reply-video-affordance')).toBeInTheDocument()
  })

  it('PM-1895 shows a tile badge while that tile buffers or pauses, not on loop restarts or another tile', async () => {
    const second: ReplyAsset = {
      url: 'https://x/clip2.mp4',
      filename: 'clip2.mp4',
      kind: 'video'
    }
    renderGroup([video, second])
    const [first, other] = screen.getAllByTestId('reply-video-preview')
    const playingTile = screen.getByRole('button', {
      name: 'Open video: clip.mp4'
    })

    await fireEvent(first, new Event('playing'))
    expect(
      within(playingTile).queryByTestId('reply-video-affordance')
    ).toBeNull()

    await fireEvent(other, new Event('pause'))
    expect(
      within(playingTile).queryByTestId('reply-video-affordance')
    ).toBeNull()

    await fireEvent(other, new Event('waiting'))
    expect(
      within(playingTile).queryByTestId('reply-video-affordance')
    ).toBeNull()

    Object.defineProperty(first, 'seeking', { value: true, configurable: true })
    await fireEvent(first, new Event('waiting'))
    expect(
      within(playingTile).queryByTestId('reply-video-affordance')
    ).toBeNull()

    Object.defineProperty(first, 'seeking', { value: false })
    await fireEvent(first, new Event('waiting'))
    expect(
      within(playingTile).getByTestId('reply-video-affordance')
    ).toBeInTheDocument()

    await fireEvent(first, new Event('playing'))
    expect(
      within(playingTile).queryByTestId('reply-video-affordance')
    ).toBeNull()

    await fireEvent(first, new Event('pause'))
    expect(
      within(playingTile).getByTestId('reply-video-affordance')
    ).toBeInTheDocument()
  })

  it('PM-1895 keeps the play badge when the browser refuses the preview', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new Error('NotAllowedError')
    )
    renderGroup([video])

    await userEvent.hover(screen.getByTestId('reply-video-preview'))
    expect(screen.getByTestId('reply-video-affordance')).toBeInTheDocument()
  })

  it('renders an audio card per audio asset outside the visual grid', () => {
    renderGroup([audio])

    const card = screen.getByTestId('audio-card')
    expect(card.dataset.src).toBe('https://x/song.mp3')
    expect(card.dataset.title).toBe('song.mp3')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('uses the presentation label for audio and 3D titles', async () => {
    renderGroup([
      { ...audio, filename: 'upload_song.mp3', label: 'song.mp3' },
      { ...model, filename: 'asset-hash', label: 'model.glb' }
    ])

    expect(screen.getByTestId('audio-card').dataset.title).toBe('song.mp3')
    await userEvent.click(screen.getByRole('button', { name: 'model.glb' }))
    expect(useDialogStore().showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'model.glb' })
    )
  })

  it('collapses long audio lists behind Show more', async () => {
    renderGroup(
      Array.from({ length: 6 }, (_, n) => ({
        ...audio,
        url: `https://x/song${n}.mp3`,
        filename: `song${n}.mp3`
      }))
    )

    expect(screen.getAllByTestId('audio-card')).toHaveLength(5)

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getAllByTestId('audio-card')).toHaveLength(6)
  })

  it('opens the 3D viewer dialog instead of the lightbox', async () => {
    renderGroup([model, image(1)])

    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))

    expect(useDialogStore().showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'asset-3d-viewer',
        title: 'mesh.glb',
        props: { modelUrl: 'https://x/api/view?filename=mesh.glb' }
      })
    )
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
  })

  it('renders the server preview image on a 3D tile when one exists', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    findServerPreviewUrl.mockResolvedValue('https://x/mesh_preview.png')
    renderGroup([model])

    const thumb = await screen.findByRole('img', { name: 'mesh.glb' })
    expect(thumb).toHaveAttribute('src', 'https://x/mesh_preview.png')
    expect(findServerPreviewUrl).toHaveBeenCalledWith('mesh.glb')
  })

  it('keeps the 3D icon tile when no server preview exists', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    renderGroup([model])

    await waitFor(() =>
      expect(findServerPreviewUrl).toHaveBeenCalledWith('mesh.glb')
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'mesh.glb' })).toBeInTheDocument()
  })

  it('skips preview lookups when the asset API is unavailable', () => {
    renderGroup([model, audio])

    expect(findServerPreviewUrl).not.toHaveBeenCalled()
    expect(findOutputAsset).not.toHaveBeenCalled()
  })

  it('titles audio cards with the resolved asset name, falling back to filename', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    findOutputAsset.mockResolvedValue({
      id: 'audio',
      name: 'qa_audio_opus_00001'
    })
    renderGroup([audio])

    await waitFor(() =>
      expect(screen.getByTestId('audio-card').dataset.title).toBe(
        'qa_audio_opus_00001'
      )
    )
    expect(findOutputAsset).toHaveBeenCalledWith('song.mp3')
  })

  it('generates a thumbnail offscreen when the server has none', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail.mockResolvedValue({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,gen'
    })
    renderGroup([model])

    const thumb = await screen.findByRole('img', { name: 'mesh.glb' })
    expect(thumb).toHaveAttribute('src', 'data:image/png;base64,gen')
    expect(generateModelThumbnail).toHaveBeenCalledWith(
      'https://x/api/view?filename=mesh.glb',
      'mesh.glb',
      expect.any(AbortSignal)
    )
  })

  it('retries offscreen generation when the renderer queue is busy', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail
      .mockResolvedValueOnce({ status: 'busy' })
      .mockResolvedValueOnce({
        status: 'rendered',
        dataUrl: 'data:image/png;base64,retried'
      })
    renderGroup([model])

    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())
    await vi.advanceTimersToNextTimerAsync()

    const thumbnail = await screen.findByRole('img', { name: 'mesh.glb' })
    expect(generateModelThumbnail).toHaveBeenCalledTimes(2)
    expect(thumbnail).toHaveAttribute('src', 'data:image/png;base64,retried')
  })

  it('cancels a pending busy retry on teardown', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail.mockResolvedValue({ status: 'busy' })
    const wrapper = renderGroup([model])
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(2000)

    expect(generateModelThumbnail).toHaveBeenCalledOnce()
  })

  it('stops retrying when the renderer queue stays busy', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail.mockResolvedValue({ status: 'busy' })
    renderGroup([model])
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())

    await vi.runAllTimersAsync()

    // The initial attempt plus MAX_THUMBNAIL_BUSY_RETRIES. The backoff is
    // exponential and capped at eight minutes, so this covers a longer busy
    // period than a flat ladder of the same length would.
    expect(generateModelThumbnail).toHaveBeenCalledTimes(10)
  })

  it('generates thumbnails only for model URLs that name a filename query', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const pathStyleModel: ReplyAsset = {
      url: 'https://x/models/scene.glb',
      filename: 'scene.glb',
      kind: '3D'
    }
    renderGroup([pathStyleModel, model])

    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())
    expect(generateModelThumbnail).toHaveBeenCalledWith(
      'https://x/api/view?filename=mesh.glb',
      'mesh.glb',
      expect.any(AbortSignal)
    )
  })

  it('does not generate a thumbnail after unmounting during preview lookup', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const preview = deferred<string | null>()
    findServerPreviewUrl.mockReturnValueOnce(preview.promise)
    const { unmount } = renderGroup([model])

    unmount()
    preview.resolve(null)
    await Promise.resolve()

    expect(generateModelThumbnail).not.toHaveBeenCalled()
  })

  it('settles a rejected preview lookup into the bounded retry path', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    findServerPreviewUrl
      .mockRejectedValueOnce(new Error('preview lookup failed'))
      .mockResolvedValueOnce('https://x/mesh_preview.png')
    renderGroup([model])
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))

    await vi.advanceTimersByTimeAsync(2_000)

    expect(findServerPreviewUrl).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img', { name: 'mesh.glb' })).toHaveAttribute(
      'src',
      'https://x/mesh_preview.png'
    )
  })

  it('cancels a pending retry when the viewer close finds a server preview', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))

    findServerPreviewUrl.mockResolvedValue('https://x/mesh_preview.png')
    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))
    const dialog = vi.mocked(useDialogStore().showDialog).mock.calls.at(-1)?.[0]
    const onClose = dialog?.dialogComponentProps?.onClose
    if (typeof onClose !== 'function') throw new Error('Expected onClose')
    onClose()
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(generateModelThumbnail).toHaveBeenCalledOnce()
    expect(screen.getByRole('img', { name: 'mesh.glb' })).toHaveAttribute(
      'src',
      'https://x/mesh_preview.png'
    )
  })

  it('retries a model deferred by queue backpressure', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail
      .mockResolvedValueOnce({ status: 'busy' })
      .mockResolvedValueOnce({
        status: 'rendered',
        dataUrl: 'data:image/png;base64,retried'
      })
    renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )

    await vi.advanceTimersByTimeAsync(2_000)

    expect(generateModelThumbnail).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('img', { name: 'mesh.glb' })).toHaveAttribute(
      'src',
      'data:image/png;base64,retried'
    )
  })

  it('bounds sustained queue backpressure with exponential retries and one server lookup', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.setSystemTime(0)
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail.mockResolvedValue({ status: 'busy' })
    renderGroup([model])
    await vi.advanceTimersByTimeAsync(0)
    expect(generateModelThumbnail).toHaveBeenCalledOnce()

    const retryDelays = [2, 4, 8, 16, 32, 64, 128, 256, 480]
    for (const [index, delaySeconds] of retryDelays.entries()) {
      await vi.advanceTimersByTimeAsync(delaySeconds * 1000 - 1)
      expect(generateModelThumbnail).toHaveBeenCalledTimes(index + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(generateModelThumbnail).toHaveBeenCalledTimes(index + 2)
    }

    expect(findServerPreviewUrl).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels a backpressure retry when hidden and restarts cleanly when shown', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail.mockResolvedValue({ status: 'busy' })
    const { rerender } = renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))
    await rerender({ assets: [audio] })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(generateModelThumbnail).toHaveBeenCalledOnce()

    await rerender({ assets: [model] })
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledTimes(2)
    )
    expect(findServerPreviewUrl).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(991_000)
    expect(generateModelThumbnail).toHaveBeenCalledTimes(10)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels a backpressure retry when unmounted', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    generateModelThumbnail.mockResolvedValue({ status: 'busy' })
    const { unmount } = renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))
    unmount()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(generateModelThumbnail).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds retries to exactly the initial attempt plus MAX_THUMBNAIL_RETRIES', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )

    await vi.advanceTimersByTimeAsync(2_000)
    expect(generateModelThumbnail).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(generateModelThumbnail).toHaveBeenCalledTimes(3)

    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(generateModelThumbnail).toHaveBeenCalledTimes(3)
    expect(screen.queryByRole('img', { name: 'mesh.glb' })).toBeNull()
  })

  it('cancels a pending retry timer when the asset is hidden', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const { rerender } = renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))

    await rerender({ assets: [audio] })

    await vi.advanceTimersByTimeAsync(10_000)
    expect(generateModelThumbnail).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the spent retry attempt when a pending retry is hidden', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const { rerender } = renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))

    await rerender({ assets: [audio] })
    await rerender({ assets: [model] })
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledTimes(2)
    )
    await vi.advanceTimersByTimeAsync(2_000)

    expect(generateModelThumbnail).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts queued generation when unmounted', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const generation = deferred<{
      status: 'rendered'
      dataUrl: string
    }>()
    generateModelThumbnail.mockReturnValueOnce(generation.promise)
    const { unmount } = renderGroup([model])
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())

    const [, , signal] = generateModelThumbnail.mock.calls[0]
    expect(signal?.aborted).toBe(false)

    unmount()

    expect(signal?.aborted).toBe(true)
    generation.resolve({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,x'
    })
  })

  it('clears a pending thumbnail refresh when unmounted', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const { unmount } = renderGroup([model])
    await vi.waitFor(() => expect(findServerPreviewUrl).toHaveBeenCalled())
    await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))
    const dialog = vi.mocked(useDialogStore().showDialog).mock.calls.at(-1)?.[0]
    const onClose = dialog?.dialogComponentProps?.onClose
    if (typeof onClose !== 'function') throw new Error('Expected onClose')
    onClose()
    await vi.advanceTimersByTimeAsync(0)
    const callsBeforeUnmount = findServerPreviewUrl.mock.calls.length
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(findServerPreviewUrl).toHaveBeenCalledTimes(callsBeforeUnmount)
  })

  it('refreshes the tile thumbnail after the viewer closes', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    renderGroup([model])
    await waitFor(() => expect(findServerPreviewUrl).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))

    findServerPreviewUrl.mockResolvedValue('https://x/mesh_preview.png')
    const dialog = vi.mocked(useDialogStore().showDialog).mock.calls.at(-1)?.[0]
    const onClose = dialog?.dialogComponentProps?.onClose
    if (typeof onClose !== 'function') throw new Error('Expected onClose')
    onClose()

    const thumb = await screen.findByRole('img', { name: 'mesh.glb' })
    expect(thumb).toHaveAttribute('src', 'https://x/mesh_preview.png')
  })

  it('restarts thumbnail generation when the viewer creates no server preview', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const generation = deferred<ModelThumbnailResult>()
    generateModelThumbnail.mockReturnValueOnce(generation.promise)
    renderGroup([model])
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())
    const [, , initialSignal] = generateModelThumbnail.mock.calls[0]

    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))
    const dialog = vi.mocked(useDialogStore().showDialog).mock.calls.at(-1)?.[0]
    const onClose = dialog?.dialogComponentProps?.onClose
    if (typeof onClose !== 'function') throw new Error('Expected onClose')
    onClose()

    expect(initialSignal?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(2_000)
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledTimes(2))
  })

  it('cancels dialog refresh work when its model becomes hidden', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const { rerender } = renderGroup([model])
    await waitFor(() => expect(findServerPreviewUrl).toHaveBeenCalledOnce())
    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))

    const refresh = deferred<string | null>()
    findServerPreviewUrl.mockReturnValueOnce(refresh.promise)
    const dialog = vi.mocked(useDialogStore().showDialog).mock.calls.at(-1)?.[0]
    const onClose = dialog?.dialogComponentProps?.onClose
    if (typeof onClose !== 'function') throw new Error('Expected onClose')
    onClose()
    await rerender({ assets: [audio] })

    refresh.resolve('https://x/mesh_preview.png')
    await Promise.resolve()

    expect(screen.queryByRole('img', { name: 'mesh.glb' })).toBeNull()
    expect(findServerPreviewUrl).toHaveBeenCalledTimes(2)
  })

  it('titles the 3D viewer with the resolved asset name', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    findOutputAsset.mockResolvedValue({
      id: 'model',
      name: '3d/ComfyUI_00001_.glb'
    })
    renderGroup([model])

    await waitFor(() =>
      expect(findOutputAsset).toHaveBeenCalledWith('mesh.glb')
    )
    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))

    expect(useDialogStore().showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: '3d/ComfyUI_00001_.glb' })
    )
  })

  it('collapses past three rows behind Show more and returns with Show less', async () => {
    renderGroup(Array.from({ length: 13 }, (_, n) => image(n)))

    expect(thumbs()).toHaveLength(12)
    expect(toggle()).toHaveTextContent('Show more')

    await userEvent.click(toggle())
    expect(thumbs()).toHaveLength(13)
    expect(toggle()).toHaveTextContent('Show less')

    await userEvent.click(toggle())
    expect(thumbs()).toHaveLength(12)
    expect(toggle()).toHaveTextContent('Show more')
  })

  it('generates thumbnails only for currently visible 3D entries', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const models = Array.from({ length: 13 }, (_, n) => ({
      ...model,
      url: `https://x/api/view?filename=mesh-${n}.glb`,
      filename: `mesh-${n}.glb`
    }))
    renderGroup(models)
    await waitFor(() => expect(findServerPreviewUrl).toHaveBeenCalledTimes(12))
    await waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledTimes(12)
    )
    expect(generateModelThumbnail).not.toHaveBeenCalledWith(
      'https://x/api/view?filename=mesh-12.glb',
      'mesh-12.glb',
      expect.any(AbortSignal)
    )

    await userEvent.click(toggle())
    await waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledWith(
        'https://x/api/view?filename=mesh-12.glb',
        'mesh-12.glb',
        expect.any(AbortSignal)
      )
    )
    expect(generateModelThumbnail).toHaveBeenCalledTimes(13)
  })

  it('aborts a hidden render and restarts it on re-render without leaving the tile permanently blank', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const generation = deferred<{
      status: 'rendered'
      dataUrl: string
    }>()
    generateModelThumbnail.mockReturnValueOnce(generation.promise)
    const { rerender } = renderGroup([model])
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())
    const [, , firstSignal] = generateModelThumbnail.mock.calls[0]

    await rerender({ assets: [audio] })
    expect(firstSignal?.aborted).toBe(true)

    generation.resolve({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,x'
    })
    await Promise.resolve()

    generateModelThumbnail.mockResolvedValueOnce({
      status: 'rendered',
      dataUrl: 'data:image/png;base64,restarted'
    })
    await rerender({ assets: [model] })
    await waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledWith(
        model.url,
        model.filename,
        expect.any(AbortSignal)
      )
    )
    const restartedCall = generateModelThumbnail.mock.calls.find(
      (call) => call[0] === model.url && call[2] !== firstSignal
    )
    expect(restartedCall).toBeDefined()
  })
})
