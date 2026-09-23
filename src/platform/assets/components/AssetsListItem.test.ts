import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import AssetsListItem from './AssetsListItem.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const globalConfig = { plugins: [i18n] }

const FAILED_ICON_SELECTOR = '.icon-\\[lucide--video-off\\]'
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000]

async function exhaustVideoRetries(getVideo: () => HTMLVideoElement | null) {
  for (const delay of RETRY_DELAYS_MS) {
    await fireEvent.error(getVideo()!)
    await vi.advanceTimersByTimeAsync(delay)
    await nextTick()
  }
  await fireEvent.error(getVideo()!)
  await nextTick()
}

describe('AssetsListItem', () => {
  it('renders video element with play overlay for video previews', () => {
    const { container } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.mp4',
        previewAlt: 'clip.mp4',
        isVideoPreview: true
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- no ARIA role for <video> in happy-dom
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://example.com/preview.mp4')
    expect(video).toHaveAttribute('preload', 'metadata')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for play overlay styling
    expect(container.querySelector('.bg-black\\/15')).toBeInTheDocument()
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for play icon styling
      container.querySelector('.icon-\\[lucide--play\\]')
    ).toBeInTheDocument()
  })

  it('reloads the video thumbnail after a load error', async () => {
    const { container } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.mp4',
        isVideoPreview: true
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- no ARIA role for <video> in happy-dom
    const getVideo = () => container.querySelector('video')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for the failed-state icon
    const getFailedIcon = () => container.querySelector(FAILED_ICON_SELECTOR)

    const video = getVideo()!
    const srcHistory: (string | null)[] = []
    const observer = new MutationObserver(() => {
      srcHistory.push(video.getAttribute('src'))
    })
    observer.observe(video, { attributes: true, attributeFilter: ['src'] })

    await fireEvent.error(video)
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
    await nextTick()
    observer.disconnect()

    expect(srcHistory).toEqual([null, 'https://example.com/preview.mp4'])
    expect(getVideo()).toBe(video)
    expect(getFailedIcon()).not.toBeInTheDocument()
  })

  it('replaces the video thumbnail with a failed icon after retries are exhausted', async () => {
    const user = userEvent.setup()
    const { container, emitted } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.mp4',
        isVideoPreview: true
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- no ARIA role for <video> in happy-dom
    const getVideo = () => container.querySelector('video')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for the failed-state icon
    const getFailedIcon = () => container.querySelector(FAILED_ICON_SELECTOR)

    await exhaustVideoRetries(getVideo)

    expect(getVideo()).not.toBeInTheDocument()
    expect(getFailedIcon()).toBeInTheDocument()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for play overlay styling
    expect(container.querySelector('.bg-black\\/15')).not.toBeInTheDocument()

    await user.click(getFailedIcon()!)

    expect(emitted()['preview-click']).toHaveLength(1)
  })

  it('describes the video failure on an item whose label comes from the host', async () => {
    const { container } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.mp4',
        isVideoPreview: true
      },
      attrs: {
        role: 'button',
        'aria-label': 'clip.mp4 video'
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- no ARIA role for <video> in happy-dom
    const getVideo = () => container.querySelector('video')
    const item = screen.getByRole('button', { name: 'clip.mp4 video' })

    expect(item).not.toHaveAccessibleDescription()

    await exhaustVideoRetries(getVideo)

    expect(item).toHaveAccessibleDescription('g.videoFailedToLoad')
  })

  it('does not show play overlay for non-video previews', () => {
    const { container } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.jpg',
        previewAlt: 'image.png',
        isVideoPreview: false
      },
      global: globalConfig
    })

    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('draggable', 'false')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- no ARIA role for <video> in happy-dom
    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- CSS class query for play icon styling
      container.querySelector('.icon-\\[lucide--play\\]')
    ).not.toBeInTheDocument()
  })

  it('emits preview-click when preview is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = render(AssetsListItem, {
      props: {
        previewUrl: 'https://example.com/preview.jpg',
        previewAlt: 'image.png'
      },
      global: globalConfig
    })

    await user.click(screen.getByRole('img'))

    expect(emitted()['preview-click']).toHaveLength(1)
  })

  it('emits preview-click when fallback icon is clicked', async () => {
    const user = userEvent.setup()
    const { container, emitted } = render(AssetsListItem, {
      props: {
        iconName: 'icon-[lucide--box]'
      },
      global: globalConfig
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- aria-hidden icon, no semantic query available
    const icon = container.querySelector('i')!
    await user.click(icon)

    expect(emitted()['preview-click']).toHaveLength(1)
  })
})
