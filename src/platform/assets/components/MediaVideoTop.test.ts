import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import MediaVideoTop from './MediaVideoTop.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const globalConfig = { plugins: [i18n] }

function renderedVideo(): HTMLVideoElement {
  const video = screen.getByTestId('media-asset-video')
  if (!(video instanceof HTMLVideoElement)) {
    throw new Error('Expected media-asset-video to be a video element')
  }
  return video
}

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
      },
      global: globalConfig
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    expect(video).toBeInTheDocument()
    expect(video.controls).toBe(false)
    expect(video).toHaveAttribute('src', 'https://example.com/thumb.jpg')
  })

  it('renders no src when the asset has no source', () => {
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('')
      },
      global: globalConfig
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    expect(video).toBeInTheDocument()
    expect(video).not.toHaveAttribute('src')
  })

  it('reloads the video after a load error', async () => {
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      },
      global: globalConfig
    })

    const video = renderedVideo()
    await fireEvent.error(video)
    await vi.advanceTimersByTimeAsync(500)

    const reloaded = renderedVideo()
    expect(reloaded).toBeInTheDocument()
    expect(reloaded).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- assert the failed-state fallback is absent
    expect(container.querySelector('[role="img"]')).not.toBeInTheDocument()
  })

  it('restores the play overlay when the video errors mid-playback', async () => {
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      },
      global: globalConfig
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    await fireEvent.play(video)
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the paused overlay has no ARIA role
    expect(container.querySelector('.bg-black\\/15')).not.toBeInTheDocument()

    await fireEvent.error(video)

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the paused overlay has no ARIA role
    expect(container.querySelector('.bg-black\\/15')).toBeInTheDocument()
  })

  it('shows a failed state once the retries are exhausted', async () => {
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      },
      global: globalConfig
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    for (const delay of [500, 1000, 2000, 4000, 8000]) {
      await fireEvent.error(video)
      await vi.advanceTimersByTimeAsync(delay)
    }
    await fireEvent.error(video)
    await nextTick()

    expect(
      screen.getByRole('img', { name: 'g.videoFailedToLoad' })
    ).toBeVisible()
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    expect(container.querySelector('video')).not.toBeInTheDocument()
    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the paused overlay has no ARIA role
    expect(container.querySelector('.bg-black\\/15')).not.toBeInTheDocument()
  })

  it('shows native controls only while playing and hovered', async () => {
    const user = userEvent.setup()
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      },
      global: globalConfig
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!

    await fireEvent.play(video)
    expect(video.controls).toBe(false)

    await user.hover(video)
    expect(video.controls).toBe(true)

    await fireEvent.pause(video)
    expect(video.controls).toBe(false)

    await fireEvent.play(video)
    expect(video.controls).toBe(true)

    await user.unhover(video)
    expect(video.controls).toBe(false)
  })

  it('starts playback from click when controls are hidden', async () => {
    const user = userEvent.setup()
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg')
      },
      global: globalConfig
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
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
        },
        global: globalConfig
      })

      // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
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

  it('pauses playback from a subsequent click when native controls are disabled', async () => {
    const user = userEvent.setup()
    const { container } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg'),
        showNativeControls: false
      },
      global: globalConfig
    })

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})

    Object.defineProperty(video, 'paused', {
      value: false,
      configurable: true
    })

    await fireEvent.play(video)
    await user.hover(video)
    expect(video.controls).toBe(false)

    await user.click(video)

    expect(pauseSpy).toHaveBeenCalledTimes(1)
  })

  it('does not start a selected preview that unmounts before metadata loads', async () => {
    const { unmount } = render(MediaVideoTop, {
      props: {
        asset: createVideoAsset('https://example.com/thumb.jpg'),
        previewStartedAt: Date.now()
      },
      global: globalConfig
    })

    const video = renderedVideo()
    const playSpy = vi
      .spyOn(video, 'play')
      .mockImplementation(() => Promise.resolve())
    await nextTick()
    expect(playSpy).not.toHaveBeenCalled()

    unmount()
    await fireEvent(video, new Event('loadedmetadata'))

    expect(playSpy).not.toHaveBeenCalled()
  })

  it('plays from the selection join time and stops without restarting the group', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000)
    const startedAt = Date.now() - 2500
    const asset = createVideoAsset('https://example.com/thumb.jpg')
    const { rerender } = render(MediaVideoTop, {
      props: { asset, previewStartedAt: startedAt },
      global: globalConfig
    })

    const video = renderedVideo()
    const playSpy = vi
      .spyOn(video, 'play')
      .mockImplementation(() => Promise.resolve())
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})
    let currentTime = 0
    Object.defineProperty(video, 'duration', { value: 10, configurable: true })
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      }
    })

    await nextTick()
    await fireEvent(video, new Event('loadedmetadata'))

    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(currentTime).toBeCloseTo(2.5)

    playSpy.mockClear()
    await rerender({ asset, previewStartedAt: startedAt })
    await fireEvent(video, new Event('loadedmetadata'))
    expect(playSpy).not.toHaveBeenCalled()

    await rerender({ asset, previewStartedAt: null })
    expect(pauseSpy).toHaveBeenCalled()
    expect(currentTime).toBe(0)
  })

  it('starts playback when metadata is loaded but duration is not yet known', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000)
    const asset = createVideoAsset('https://example.com/thumb.jpg')
    const { rerender } = render(MediaVideoTop, {
      props: { asset, previewStartedAt: null },
      global: globalConfig
    })

    const video = renderedVideo()
    Object.defineProperty(video, 'readyState', {
      value: 1,
      configurable: true
    })
    Object.defineProperty(video, 'duration', {
      value: Number.NaN,
      configurable: true
    })
    let currentTime = 0
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      }
    })
    const playSpy = vi
      .spyOn(video, 'play')
      .mockImplementation(() => Promise.resolve())

    await rerender({ asset, previewStartedAt: Date.now() - 2500 })

    expect(playSpy).toHaveBeenCalledTimes(1)
    expect(currentTime).toBe(0)

    Object.defineProperty(video, 'duration', { value: 10, configurable: true })
    await fireEvent(video, new Event('durationchange'))

    expect(currentTime).toBeCloseTo(2.5)
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('restarts the selected preview after a source retry', async () => {
    const asset = createVideoAsset('https://example.com/thumb.jpg')
    render(MediaVideoTop, {
      props: { asset, previewStartedAt: Date.now() },
      global: globalConfig
    })

    const video = renderedVideo()
    Object.defineProperty(video, 'readyState', {
      value: 2,
      configurable: true
    })
    Object.defineProperty(video, 'duration', { value: 10, configurable: true })
    const playSpy = vi
      .spyOn(video, 'play')
      .mockImplementation(() => Promise.resolve())

    await nextTick()
    await fireEvent(video, new Event('loadedmetadata'))
    expect(playSpy).toHaveBeenCalledTimes(1)

    await fireEvent.error(video)
    await vi.advanceTimersByTimeAsync(500)
    await nextTick()

    const retried = renderedVideo()
    expect(retried).not.toBe(video)
    Object.defineProperty(retried, 'readyState', {
      value: 2,
      configurable: true
    })
    Object.defineProperty(retried, 'duration', {
      value: 10,
      configurable: true
    })
    const retryPlaySpy = vi
      .spyOn(retried, 'play')
      .mockImplementation(() => Promise.resolve())

    await fireEvent(retried, new Event('loadedmetadata'))

    expect(retryPlaySpy).toHaveBeenCalledTimes(1)
  })
})
