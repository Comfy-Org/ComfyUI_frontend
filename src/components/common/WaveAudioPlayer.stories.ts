import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WaveAudioPlayer from './WaveAudioPlayer.vue'

const meta: Meta<typeof WaveAudioPlayer> = {
  title: 'Components/Audio/WaveAudioPlayer',
  component: WaveAudioPlayer,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    src: '/assets/audio/sample.wav',
    barCount: 40,
    height: 32
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-80 rounded-lg bg-base-background p-4"><story /></div>'
    })
  ]
}

export const BottomAligned: Story = {
  args: {
    src: '/assets/audio/sample.wav',
    barCount: 40,
    height: 48,
    align: 'bottom'
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-80 rounded-lg bg-base-background p-4"><story /></div>'
    })
  ]
}

export const Expanded: Story = {
  args: {
    src: '/assets/audio/sample.wav',
    variant: 'expanded',
    barCount: 80,
    height: 120
  },
  decorators: [
    (story) => ({
      components: { story },
      template:
        '<div class="w-[600px] rounded-2xl bg-base-background/80 p-8 backdrop-blur-sm"><story /></div>'
    })
  ]
}
