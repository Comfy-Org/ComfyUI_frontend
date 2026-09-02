import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it, vi } from 'vitest'

import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

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

function renderVideoTop(props: ComponentProps<typeof MediaVideoTop>) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { g: { play: 'Play', pause: 'Pause' } } },
    missingWarn: false,
    fallbackWarn: false
  })
  return render(MediaVideoTop, { props, global: { plugins: [i18n] } })
}

describe('MediaVideoTop', () => {
  it('renders playable video with darkened paused overlay and play icon', () => {
    renderVideoTop({
      asset: createVideoAsset('https://example.com/thumb.jpg')
    })

    const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
    expect(video).toBeInTheDocument()
    expect(video.controls).toBe(false)
    const source = screen.getByTestId<HTMLSourceElement>('media-video-source')
    expect(source).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    expect(source).toHaveAttribute('type', 'video/mp4')
  })

  it('does not render source element when src is empty', () => {
    renderVideoTop({
      asset: createVideoAsset('')
    })

    expect(screen.getByLabelText('clip.mp4')).toBeInTheDocument()
    expect(screen.queryByTestId('media-video-source')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('emits playback events and hides paused overlay while playing', async () => {
    const user = userEvent.setup()
    const { emitted } = renderVideoTop({
      asset: createVideoAsset('https://example.com/thumb.jpg')
    })

    const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
    expect(video).toBeInTheDocument()

    await fireEvent.play(video)
    expect(emitted()['videoPlayingStateChanged']?.at(-1)).toEqual([true])

    await user.hover(screen.getByTestId('media-video'))
    expect(video.controls).toBe(true)

    await user.unhover(screen.getByTestId('media-video'))
    expect(video.controls).toBe(false)

    await fireEvent.pause(video)
    expect(emitted()['videoPlayingStateChanged']?.at(-1)).toEqual([false])
    expect(video.controls).toBe(false)
  })

  it('starts playback from click when controls are hidden', async () => {
    const user = userEvent.setup()
    renderVideoTop({
      asset: createVideoAsset('https://example.com/thumb.jpg')
    })

    const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
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
      renderVideoTop({
        asset: createVideoAsset('https://example.com/thumb.jpg')
      })

      const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
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
    renderVideoTop({
      asset: createVideoAsset('https://example.com/thumb.jpg'),
      showNativeControls: false
    })

    const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})

    Object.defineProperty(video, 'paused', {
      value: false,
      configurable: true
    })

    await fireEvent.play(video)
    await user.hover(screen.getByTestId('media-video'))
    expect(video.controls).toBe(false)

    await user.click(video)

    expect(pauseSpy).toHaveBeenCalledTimes(1)
  })

  it.for([
    { name: 'Enter', key: '{Enter}' },
    { name: 'Space', key: ' ' }
  ])(
    'toggles playback from $name while native controls are hidden',
    async ({ key }) => {
      const user = userEvent.setup()
      renderVideoTop({
        asset: createVideoAsset('https://example.com/thumb.jpg')
      })

      const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
      const playSpy = vi
        .spyOn(video, 'play')
        .mockImplementation(() => Promise.resolve())
      const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})

      Object.defineProperty(video, 'paused', {
        value: true,
        configurable: true
      })

      await user.tab()
      expect(screen.getByRole('button', { name: 'Play' })).toHaveFocus()

      await user.keyboard(key)
      expect(playSpy).toHaveBeenCalledTimes(1)

      await fireEvent.play(video)
      Object.defineProperty(video, 'paused', {
        value: false,
        configurable: true
      })
      expect(screen.getByRole('button', { name: 'Pause' })).toHaveFocus()

      await user.keyboard(key)
      expect(pauseSpy).toHaveBeenCalledTimes(1)
    }
  )

  it('hides the play button only while native controls are visible', async () => {
    const user = userEvent.setup()
    renderVideoTop({
      asset: createVideoAsset('https://example.com/thumb.jpg')
    })

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()

    const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
    await fireEvent.play(video)
    await user.hover(screen.getByTestId('media-video'))
    expect(video.controls).toBe(true)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    await user.unhover(screen.getByTestId('media-video'))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })
})
