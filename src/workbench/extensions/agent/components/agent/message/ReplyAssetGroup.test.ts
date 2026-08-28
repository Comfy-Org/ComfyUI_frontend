import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  vi.fn(async (): Promise<string | null> => null)
)
vi.mock('@/components/load3d/modelThumbnail', () => ({
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
    generateModelThumbnail.mockReset().mockResolvedValue(null)
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
    generateModelThumbnail.mockResolvedValue('data:image/png;base64,gen')
    renderGroup([model])

    const thumb = await screen.findByRole('img', { name: 'mesh.glb' })
    expect(thumb).toHaveAttribute('src', 'data:image/png;base64,gen')
    expect(generateModelThumbnail).toHaveBeenCalledWith(
      'https://x/mesh.glb',
      'mesh.glb'
    )
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
})
