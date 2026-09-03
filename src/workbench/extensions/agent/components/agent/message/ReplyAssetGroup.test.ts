import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ModelThumbnailResult } from '@/components/load3d/modelThumbnail'
import { i18n } from '@/i18n'

import type { ReplyAsset } from '../../../utils/replyAssets'
import ReplyAssetGroup from './ReplyAssetGroup.vue'

const showDialog = vi.hoisted(() => vi.fn())
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))

const isAssetPreviewSupported = vi.hoisted(() => vi.fn(() => false))
const findServerPreviewUrl = vi.hoisted(() =>
  vi.fn(async (): Promise<string | null> => null)
)
const findOutputAsset = vi.hoisted(() =>
  vi.fn(async (): Promise<{ name: string } | undefined> => undefined)
)
vi.mock('@/platform/assets/utils/assetPreviewUtil', () => ({
  isAssetPreviewSupported,
  findServerPreviewUrl,
  findOutputAsset
}))

const generateModelThumbnail = vi.hoisted(() =>
  vi.fn(
    async (
      _modelUrl: string,
      _assetName: string,
      _callerSignal?: AbortSignal
    ): Promise<ModelThumbnailResult> => ({ status: 'failed' })
  )
)
vi.mock('@/components/load3d/modelThumbnail', () => ({
  generateModelThumbnail
}))

const reportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

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
  url: 'https://x/mesh.glb',
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
const toggle = () =>
  screen.getAllByRole('button').find((b) => !b.getAttribute('aria-label'))

describe('ReplyAssetGroup', () => {
  beforeEach(() => {
    showDialog.mockClear()
    isAssetPreviewSupported.mockReset().mockReturnValue(false)
    findServerPreviewUrl.mockReset().mockResolvedValue(null)
    findOutputAsset.mockReset().mockResolvedValue(undefined)
    generateModelThumbnail.mockReset().mockResolvedValue({ status: 'failed' })
    reportError.mockReset()
  })

  it('T-09 / PM-652 / FE-1326 renders image and video previews inline', () => {
    renderGroup([image(1), video])

    expect(screen.getByRole('img', { name: 'i1.png' })).toBeInTheDocument()
    expect(screen.getByTestId('reply-video-preview')).toBeInTheDocument()
  })

  it('T-09 / PM-652 / FE-1326 opens inspect view at the clicked visual asset', async () => {
    renderGroup([image(1), video])

    await userEvent.click(screen.getByRole('button', { name: 'clip.mp4' }))

    const lightbox = screen.getByTestId('lightbox')
    expect(lightbox.dataset.active).toBe('1')
    expect(lightbox.dataset.count).toBe('2')
  })

  it('plays a video preview on hover and pauses on leave', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue()
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {})
    renderGroup([video, image(1)])
    const element = screen.getByTestId('reply-video-preview')

    await userEvent.hover(element)
    expect(play).toHaveBeenCalledTimes(1)

    await userEvent.unhover(element)
    expect(pause).toHaveBeenCalledTimes(1)

    play.mockRestore()
    pause.mockRestore()
  })

  it('renders an audio card per audio asset outside the visual grid', () => {
    renderGroup([audio])

    const card = screen.getByTestId('audio-card')
    expect(card.dataset.src).toBe('https://x/song.mp3')
    expect(card.dataset.title).toBe('song.mp3')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
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

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'asset-3d-viewer',
        title: 'mesh.glb',
        props: { modelUrl: 'https://x/mesh.glb' }
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
    findOutputAsset.mockResolvedValue({ name: 'qa_audio_opus_00001' })
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
      'https://x/mesh.glb',
      'mesh.glb',
      expect.any(AbortSignal)
    )
  })

  it('does not generate a thumbnail after unmounting during preview lookup', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    let resolvePreview!: (value: string | null) => void
    findServerPreviewUrl.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreview = resolve
      })
    )
    const { unmount } = renderGroup([model])

    unmount()
    resolvePreview(null)
    await Promise.resolve()

    expect(generateModelThumbnail).not.toHaveBeenCalled()
  })

  it('reports preview lookup failures and retries generation on a timed pass', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    findServerPreviewUrl.mockRejectedValueOnce(new Error('preview failed'))
    renderGroup([model])

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'agent_reply_asset_preview_failure'
      })
    )
    expect(generateModelThumbnail).not.toHaveBeenCalled()

    // A rejected lookup schedules a bounded retry rather than requiring a
    // re-render to pick it back up (see modelThumbnailSrc / scheduleThumbnailRetry:
    // deleting the key on failure was tried and found inert, since nothing
    // re-triggers the watcher once the message stops changing).
    await vi.advanceTimersByTimeAsync(2000)
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())
  })

  it('does not report a lookup failure for a strand abandoned by unmount', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    let rejectPreview!: (error: Error) => void
    findServerPreviewUrl.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectPreview = reject
      })
    )
    const { unmount } = renderGroup([model])

    unmount()
    rejectPreview(new Error('preview failed'))
    await Promise.resolve()
    await Promise.resolve()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('cancels a pending retry when the viewer close finds a server preview', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    vi.useFakeTimers()
    try {
      renderGroup([model])
      await vi.waitFor(() =>
        expect(generateModelThumbnail).toHaveBeenCalledOnce()
      )
      expect(vi.getTimerCount()).toBe(1)

      findServerPreviewUrl.mockResolvedValue('https://x/mesh_preview.png')
      await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))
      const dialog = showDialog.mock.calls.at(-1)?.[0]
      dialog.dialogComponentProps.onClose()
      await vi.advanceTimersByTimeAsync(0)

      expect(vi.getTimerCount()).toBe(0)
      await vi.advanceTimersByTimeAsync(10_000)
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
      expect(screen.getByRole('img', { name: 'mesh.glb' })).toHaveAttribute(
        'src',
        'https://x/mesh_preview.png'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves a model that failed to render as a placeholder', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    renderGroup([model])
    await vi.waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
    )

    vi.useFakeTimers()
    try {
      await vi.advanceTimersByTimeAsync(30_000)
    } finally {
      vi.useRealTimers()
    }

    expect(generateModelThumbnail).toHaveBeenCalledOnce()
    expect(screen.queryByRole('img', { name: 'mesh.glb' })).toBeNull()
  })

  it('bounds retries to exactly the initial attempt plus MAX_THUMBNAIL_RETRY_ATTEMPTS', async () => {
    // Regression coverage for a bug where every retry rescheduled with
    // attempts=0 instead of the incremented count, so a persistently
    // failing render never reached MAX_THUMBNAIL_RETRY_ATTEMPTS and kept
    // rescheduling every THUMBNAIL_RETRY_DELAY_MS indefinitely.
    isAssetPreviewSupported.mockReturnValue(true)
    vi.useFakeTimers()
    try {
      renderGroup([model])
      await vi.waitFor(() =>
        expect(generateModelThumbnail).toHaveBeenCalledOnce()
      )

      // MAX_THUMBNAIL_RETRY_ATTEMPTS = 2, THUMBNAIL_RETRY_DELAY_MS = 2000:
      // the initial call plus 2 retries is 3 total calls, then the retry
      // budget is spent and no further calls are scheduled.
      await vi.advanceTimersByTimeAsync(2_000)
      expect(generateModelThumbnail).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(2_000)
      expect(generateModelThumbnail).toHaveBeenCalledTimes(3)

      // No timer left pending once the budget is spent.
      expect(vi.getTimerCount()).toBe(0)
      await vi.advanceTimersByTimeAsync(10_000)
      expect(generateModelThumbnail).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels a pending retry timer when the asset is hidden', async () => {
    // Regression coverage: a retry scheduled while the tile was visible
    // used to keep a bare setTimeout with no per-url handle, so
    // `hideThumbnail` (fired by "Show less" / the asset leaving
    // visibleVisual) had nothing to cancel. The retry fired anyway and
    // called loadModelThumbnail for an asset the watcher had already
    // dropped from thumbnailState.
    isAssetPreviewSupported.mockReturnValue(true)
    vi.useFakeTimers()
    try {
      const { rerender } = renderGroup([model])
      await vi.waitFor(() =>
        expect(generateModelThumbnail).toHaveBeenCalledOnce()
      )

      // The failed render schedules a retry in THUMBNAIL_RETRY_DELAY_MS.
      // Hide the asset before that retry fires.
      await rerender({ assets: [audio] })

      await vi.advanceTimersByTimeAsync(10_000)
      expect(generateModelThumbnail).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts queued generation when unmounted', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    // Keep the render pending so the strand is still 'loading' (not yet
    // settled to 'ready'/'gaveUp') when unmount fires — a mock that
    // resolves immediately would let the retry-on-failure transition win
    // the race and leave nothing in flight to abort.
    let resolveGenerate!: (result: {
      status: 'rendered'
      dataUrl: string
    }) => void
    generateModelThumbnail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGenerate = resolve
      })
    )
    const { unmount } = renderGroup([model])
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())

    const [, , signal] = generateModelThumbnail.mock.calls[0]
    expect(signal?.aborted).toBe(false)

    unmount()

    expect(signal?.aborted).toBe(true)
    resolveGenerate({ status: 'rendered', dataUrl: 'data:image/png;base64,x' })
  })

  it('clears a pending thumbnail refresh when unmounted', async () => {
    vi.useFakeTimers()
    try {
      isAssetPreviewSupported.mockReturnValue(true)
      const { unmount } = renderGroup([model])
      await vi.waitFor(() => expect(findServerPreviewUrl).toHaveBeenCalled())
      // The initial lookup's fallback render (default mock: 'failed') has
      // already scheduled its own bounded retry alongside the dialog-close
      // refresh below, so two independent timers are pending at this point.
      await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))
      await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))
      const dialog = showDialog.mock.calls.at(-1)?.[0]
      dialog.dialogComponentProps.onClose()
      await vi.advanceTimersByTimeAsync(0)
      const callsBeforeUnmount = findServerPreviewUrl.mock.calls.length
      expect(vi.getTimerCount()).toBe(2)

      unmount()
      expect(vi.getTimerCount()).toBe(0)

      await vi.advanceTimersByTimeAsync(2_000)
      expect(findServerPreviewUrl).toHaveBeenCalledTimes(callsBeforeUnmount)
    } finally {
      vi.useRealTimers()
    }
  })

  it('refreshes the tile thumbnail after the viewer closes', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    renderGroup([model])
    await waitFor(() => expect(findServerPreviewUrl).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))

    findServerPreviewUrl.mockResolvedValue('https://x/mesh_preview.png')
    const dialog = showDialog.mock.calls.at(-1)?.[0]
    dialog.dialogComponentProps.onClose()

    const thumb = await screen.findByRole('img', { name: 'mesh.glb' })
    expect(thumb).toHaveAttribute('src', 'https://x/mesh_preview.png')
  })

  it('titles the 3D viewer with the resolved asset name', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    findOutputAsset.mockResolvedValue({ name: '3d/ComfyUI_00001_.glb' })
    renderGroup([model])

    await waitFor(() =>
      expect(findOutputAsset).toHaveBeenCalledWith('mesh.glb')
    )
    await userEvent.click(screen.getByRole('button', { name: 'mesh.glb' }))

    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: '3d/ComfyUI_00001_.glb' })
    )
  })

  it('collapses past three rows behind Show more and returns with Show less', async () => {
    renderGroup(Array.from({ length: 13 }, (_, n) => image(n)))

    expect(thumbs()).toHaveLength(12)
    expect(toggle()).toHaveTextContent('Show more')

    await userEvent.click(toggle()!)
    expect(thumbs()).toHaveLength(13)
    expect(toggle()).toHaveTextContent('Show less')

    await userEvent.click(toggle()!)
    expect(thumbs()).toHaveLength(12)
    expect(toggle()).toHaveTextContent('Show more')
  })

  it('generates thumbnails only for currently visible 3D entries', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    const models = Array.from({ length: 13 }, (_, n) => ({
      ...model,
      url: `https://x/mesh-${n}.glb`,
      filename: `mesh-${n}.glb`
    }))
    renderGroup(models)
    await waitFor(() => expect(findServerPreviewUrl).toHaveBeenCalledTimes(12))
    await waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledTimes(12)
    )
    expect(generateModelThumbnail).not.toHaveBeenCalledWith(
      'https://x/mesh-12.glb',
      'mesh-12.glb',
      expect.any(AbortSignal)
    )

    await userEvent.click(toggle()!)
    await waitFor(() =>
      expect(generateModelThumbnail).toHaveBeenCalledWith(
        'https://x/mesh-12.glb',
        'mesh-12.glb',
        expect.any(AbortSignal)
      )
    )
    expect(generateModelThumbnail).toHaveBeenCalledTimes(13)
  })

  it('aborts a hidden render and restarts it on re-render without leaving the tile permanently blank', async () => {
    isAssetPreviewSupported.mockReturnValue(true)
    let resolveGenerate!: (result: {
      status: 'rendered'
      dataUrl: string
    }) => void
    generateModelThumbnail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGenerate = resolve
      })
    )
    const { rerender } = renderGroup([model])
    await waitFor(() => expect(generateModelThumbnail).toHaveBeenCalledOnce())
    const [, , firstSignal] = generateModelThumbnail.mock.calls[0]

    // The asset drops out of visibleVisual (e.g. the message shrinking to
    // just the audio track) before its render settles.
    await rerender({ assets: [audio] })
    expect(firstSignal?.aborted).toBe(true)

    // A late resolution of the aborted strand must not resurrect it as the
    // tile's src (it is no longer the owning strand for that url).
    resolveGenerate({ status: 'rendered', dataUrl: 'data:image/png;base64,x' })
    await Promise.resolve()

    // The asset becomes visible again: it must restart, not stay
    // permanently blank (the bug this replaced state model fixes).
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
