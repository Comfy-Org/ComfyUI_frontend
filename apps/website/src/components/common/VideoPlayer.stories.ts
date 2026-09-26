import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import VideoPlayer from './VideoPlayer.vue'

const videoSrc =
  'https://media.comfy.org/website/homepage/showcase/ui-overview.webm'

const meta: Meta<typeof VideoPlayer> = {
  title: 'Website/Common/VideoPlayer',
  component: VideoPlayer,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink mx-auto max-w-4xl p-8"><story /></div>'
    })
  ],
  args: {
    src: videoSrc,
    poster: '/images/demos/image-to-video-thumb.webp',
    ariaLabel: 'ComfyUI interface overview',
    hideFullscreen: true
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const muteButton = canvas.getByRole('button', { name: 'Mute' })

    await userEvent.click(muteButton)
    await expect(canvas.getByRole('button', { name: 'Unmute' })).toBeVisible()
  }
}

export const WithCaptions: Story = {
  args: {
    tracks: [
      {
        src: 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A00%3A00.000%20--%3E%2000%3A05.000%0AComfyUI%20workflow',
        kind: 'captions',
        srclang: 'en',
        label: 'English'
      }
    ]
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const captionsButton = canvas.getByRole('button', {
      name: 'Subtitles on'
    })

    await userEvent.click(captionsButton)
    await expect(
      canvas.getByRole('button', { name: 'Subtitles off' })
    ).toBeVisible()
  }
}

export const KeyboardSeek: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const video = canvasElement.querySelector('video')
    const seek = canvas.getByRole('slider', { name: 'Seek' })

    if (!video) throw new Error('Video element did not render')
    Object.defineProperty(video, 'duration', { configurable: true, value: 30 })
    video.dispatchEvent(new Event('durationchange'))
    seek.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(seek).toHaveAttribute('aria-valuenow', '5')
  }
}

export const Minimal: Story = {
  args: {
    minimal: true
  }
}

export const MuteOnly: Story = {
  args: {
    autoplay: true,
    loop: true,
    muteOnly: true
  }
}

export const Contained: Story = {
  args: {
    fit: 'contain'
  }
}

export const ReducedMotionPreview: Story = {
  args: {
    autoplay: true,
    loop: true
  },
  parameters: {
    reducedMotion: 'reduce',
    docs: {
      description: {
        story:
          'Autoplay is suppressed when the browser reports reduced-motion preference.'
      }
    }
  }
}
