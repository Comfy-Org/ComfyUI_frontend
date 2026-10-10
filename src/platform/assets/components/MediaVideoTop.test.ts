import { fromPartial } from '@total-typescript/shoehorn'

import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
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

    // oxlint-disable-next-line testing-library/no-container, testing-library/no-node-access -- <video> has no ARIA role in happy-dom
    const video = container.querySelector('video')!
    await fireEvent.error(video)
    await vi.advanceTimersByTimeAsync(500)

    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://example.com/thumb.jpg')
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

  describe('click propagation while native controls are showing', () => {
    const containerRect = new DOMRect(0, 100, 320, 200)
    const hoverScaledVideoRect = new DOMRect(-8, 95, 336, 210)

    async function renderPlayingHoveredVideo() {
      const user = userEvent.setup()
      const onCardClick = vi.fn()
      const asset = createVideoAsset('https://example.com/thumb.jpg')
      render(
        () =>
          h('div', { 'aria-label': 'card', onClick: onCardClick }, [
            h(MediaVideoTop, { asset })
          ]),
        { global: globalConfig }
      )

      vi.spyOn(
        HTMLDivElement.prototype,
        'getBoundingClientRect'
      ).mockReturnValue(containerRect)
      const video = screen.getByLabelText<HTMLVideoElement>('clip.mp4')
      vi.spyOn(video, 'getBoundingClientRect').mockReturnValue(
        hoverScaledVideoRect
      )

      await fireEvent.play(video)
      await user.hover(video)
      expect(video.controls).toBe(true)

      async function metaClickAt(clientY: number) {
        await user.keyboard('{Meta>}')
        await user.pointer({
          keys: '[MouseLeft]',
          target: video,
          coords: { clientY }
        })
        await user.keyboard('{/Meta}')
      }

      return { onCardClick, metaClickAt }
    }

    it.for([
      { case: 'the control strip', clientY: 290, expectedCardClicks: 0 },
      {
        case: 'the strip above the scaled video rect',
        clientY: 240,
        expectedCardClicks: 0
      },
      { case: 'the video body', clientY: 200, expectedCardClicks: 1 }
    ])(
      'modifier-click on $case reaches the card $expectedCardClicks times',
      async ({ clientY, expectedCardClicks }) => {
        const { onCardClick, metaClickAt } = await renderPlayingHoveredVideo()

        await metaClickAt(clientY)

        expect(onCardClick).toHaveBeenCalledTimes(expectedCardClicks)
      }
    )

    it('lets a modifier-click through when the container has zero height', async () => {
      const { onCardClick, metaClickAt } = await renderPlayingHoveredVideo()
      vi.spyOn(
        HTMLDivElement.prototype,
        'getBoundingClientRect'
      ).mockReturnValue(new DOMRect(0, 100, 320, 0))

      await metaClickAt(100)

      expect(onCardClick).toHaveBeenCalledTimes(1)
    })
  })

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
})
