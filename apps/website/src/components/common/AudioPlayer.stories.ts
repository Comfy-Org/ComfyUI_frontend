import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import AudioPlayer from './AudioPlayer.vue'

const meta: Meta<typeof AudioPlayer> = {
  title: 'Website/Common/AudioPlayer',
  component: AudioPlayer,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink mx-auto max-w-3xl p-8"><story /></div>'
    })
  ],
  args: {
    poster: '/images/mcp/mcp-thumb-moodboard.webp',
    ariaLabel: 'Generated music preview',
    sources: [
      {
        src: 'https://media.comfy.org/website/minimax-music-3/audio_minimax_music3_00063.mp3',
        type: 'audio/mpeg'
      }
    ]
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const KeyboardSeek: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const audio = canvasElement.querySelector('audio')
    const seek = canvas.getByRole('slider', { name: 'Seek' })

    if (!audio) throw new Error('Audio element did not render')
    Object.defineProperty(audio, 'duration', { configurable: true, value: 40 })
    audio.dispatchEvent(new Event('durationchange'))
    seek.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(seek).toHaveAttribute('aria-valuenow', '5')

    await userEvent.keyboard('{Home}')
    await expect(seek).toHaveAttribute('aria-valuenow', '0')
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
