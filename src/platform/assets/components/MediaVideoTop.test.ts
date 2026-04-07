import { describe, expect, it, vi } from 'vitest'

import { fireEvent, render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import MediaVideoTop from './MediaVideoTop.vue'

function createVideoAsset(
  src: string,
  mimeType: AssetMeta['mime_type'] = 'video/mp4'
): AssetMeta {
  return {
    id: 'video-1',
    name: 'clip.mp4',
    asset_hash: null,
    mime_type: mimeType,
    tags: [],
    kind: 'video',
    src
  }
}

describe('MediaVideoTop', () => {
  it('renders playable video with darkened paused overlay and play icon', () => {
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    expect(video).toBeInTheDocument()
    expect(video.controls).toBe(false)
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <source> has no ARIA role in happy-dom
    const source = container.querySelector('source')!
    expect(source).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    expect(source).toHaveAttribute('type', 'video/mp4')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query has no ARIA equivalent
    expect(container.querySelector('.bg-black\\/15')).toBeInTheDocument()
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query has no ARIA equivalent
      container.querySelector('.icon-\\[lucide--play\\]')
    ).toBeInTheDocument()
  })

  it('does not render source element when src is empty', () => {
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('')
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    expect(container.querySelector('video')).toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <source> has no ARIA role in happy-dom
    expect(container.querySelector('source')).not.toBeInTheDocument()
  })

  it('emits playback events and hides paused overlay while playing', async () => {
    const user = userEvent.setup()
    const { container, emitted } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    expect(video).toBeInTheDocument()

    await fireEvent.play(video)
    expect(emitted()['videoPlayingStateChanged']?.at(-1)).toEqual([true])
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query has no ARIA equivalent
    expect(container.querySelector('.bg-black\\/15')).not.toBeInTheDocument()

    // eslint-disable-next-line testing-library/no-node-access -- root wrapper has no role
    await user.hover(container.firstElementChild!)
    expect(video.controls).toBe(true)

    // eslint-disable-next-line testing-library/no-node-access -- root wrapper has no role
    await user.unhover(container.firstElementChild!)
    expect(video.controls).toBe(false)

    await fireEvent.pause(video)
    expect(emitted()['videoPlayingStateChanged']?.at(-1)).toEqual([false])
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query has no ARIA equivalent
    expect(container.querySelector('.bg-black\\/15')).toBeInTheDocument()
    expect(video.controls).toBe(false)
  })

  it('starts playback from click when controls are hidden', async () => {
    const user = userEvent.setup()
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    const playSpy = vi
      .spyOn(video, 'play')
      .mockImplementation(() => Promise.resolve())

    Object.defineProperty(video, 'paused', {
      value: true,
      configurable: true
    })

    await user.click(video)

    expect(playSpy).toHaveBeenCalledTimes(1)
  })
})
