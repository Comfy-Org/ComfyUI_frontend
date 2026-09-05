import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it, vi } from 'vitest'

import { fireEvent, render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import MediaVideoTop from './MediaVideoTop.vue'

function createVideoAsset(
  src: string,
  mimeType: AssetMeta['mime_type'] = 'video/mp4'
): AssetMeta {
  return fromPartial({
    id: 'video-1',
    name: 'clip.mp4',
    mime_type: mimeType,
    tags: [],
    kind: 'video',
    src
  })
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

    // eslint-disable-next-line testing-library/no-node-access -- root wrapper has no role
    await user.hover(container.firstElementChild!)
    expect(video.controls).toBe(true)

    // eslint-disable-next-line testing-library/no-node-access -- root wrapper has no role
    await user.unhover(container.firstElementChild!)
    expect(video.controls).toBe(false)

    await fireEvent.pause(video)
    expect(emitted()['videoPlayingStateChanged']?.at(-1)).toEqual([false])
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

  it.for([
    { modifier: 'Shift', keyDown: '{Shift>}', keyUp: '{/Shift}' },
    { modifier: 'Ctrl', keyDown: '{Control>}', keyUp: '{/Control}' },
    { modifier: 'Meta', keyDown: '{Meta>}', keyUp: '{/Meta}' }
  ])(
    'does not start playback from a $modifier-click',
    async ({ keyDown, keyUp }) => {
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

      await user.keyboard(keyDown)
      await user.click(video)
      await user.keyboard(keyUp)

      expect(playSpy).not.toHaveBeenCalled()
    }
  )

  describe('click propagation while native controls are showing', () => {
    async function renderPlayingHoveredVideo() {
      const user = userEvent.setup()
      const { container } = render(MediaVideoTop, {
        props: {
          asset: createVideoAsset('https://example.com/thumb.jpg')
        }
      })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
      const video = container.querySelector('video')!
      vi.spyOn(video, 'getBoundingClientRect').mockReturnValue(
        fromPartial({ top: 100, bottom: 300, height: 200 })
      )
      const bubbled = vi.fn()
      // eslint-disable-next-line testing-library/no-node-access -- root wrapper has no role
      container.firstElementChild!.addEventListener('click', bubbled)

      await fireEvent.play(video)
      // eslint-disable-next-line testing-library/no-node-access -- root wrapper has no role
      await user.hover(container.firstElementChild!)
      expect(video.controls).toBe(true)

      return { video, bubbled, user }
    }

    it('stops a modifier-click aimed at the native control strip', async () => {
      const { video, bubbled, user } = await renderPlayingHoveredVideo()

      await user.keyboard('{Meta>}')
      await user.pointer({
        keys: '[MouseLeft]',
        target: video,
        coords: { clientY: 290 }
      })
      await user.keyboard('{/Meta}')

      expect(bubbled).not.toHaveBeenCalled()
    })

    it('lets a modifier-click on the video body through to the card', async () => {
      const { video, bubbled, user } = await renderPlayingHoveredVideo()

      await user.keyboard('{Meta>}')
      await user.pointer({
        keys: '[MouseLeft]',
        target: video,
        coords: { clientY: 200 }
      })
      await user.keyboard('{/Meta}')

      expect(bubbled).toHaveBeenCalledTimes(1)
    })

    it('lets a modifier-click through when the video has zero height', async () => {
      const { video, bubbled, user } = await renderPlayingHoveredVideo()
      vi.spyOn(video, 'getBoundingClientRect').mockReturnValue(
        fromPartial({ top: 100, bottom: 100, height: 0 })
      )

      await user.keyboard('{Meta>}')
      await user.pointer({
        keys: '[MouseLeft]',
        target: video,
        coords: { clientY: 100 }
      })
      await user.keyboard('{/Meta}')

      expect(bubbled).toHaveBeenCalledTimes(1)
    })
  })

  it('pauses playback from a subsequent click when native controls are disabled', async () => {
    const user = userEvent.setup()
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg'),
        showNativeControls: false
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})

    Object.defineProperty(video, 'paused', {
      value: false,
      configurable: true
    })

    await fireEvent.play(video)
    // eslint-disable-next-line testing-library/no-node-access -- root wrapper has no role
    await user.hover(container.firstElementChild!)
    expect(video.controls).toBe(false)

    await user.click(video)

    expect(pauseSpy).toHaveBeenCalledTimes(1)
  })
})
