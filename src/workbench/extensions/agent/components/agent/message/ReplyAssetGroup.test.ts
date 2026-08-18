import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import type { ReplyAsset } from '../../../utils/replyAssets'
import ReplyAssetGroup from './ReplyAssetGroup.vue'

const showDialog = vi.hoisted(() => vi.fn())
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
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
        WaveAudioPlayer: {
          props: ['src'],
          template: '<div data-testid="audio-player" :data-src="src" />'
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
  })

  it('renders image and video previews inline', () => {
    renderGroup([image(1), video])

    expect(screen.getByRole('img', { name: 'i1.png' })).toBeInTheDocument()
    expect(screen.getByTestId('reply-video-preview')).toBeInTheDocument()
  })

  it('opens the lightbox at the clicked visual asset', async () => {
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

  it('renders audio as non-clickable rows with file name and player', () => {
    renderGroup([audio])

    expect(screen.getByText('song.mp3')).toBeInTheDocument()
    expect(screen.getByTestId('audio-player').dataset.src).toBe(
      'https://x/song.mp3'
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
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
