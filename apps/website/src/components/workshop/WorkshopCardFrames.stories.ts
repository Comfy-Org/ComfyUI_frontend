import type { Meta, StoryObj } from '@storybook/vue3-vite'

import WorkshopCardFrames from './WorkshopCardFrames.vue'

const meta: Meta<typeof WorkshopCardFrames> = {
  title: 'Website/Workshop/WorkshopCardFrames',
  component: WorkshopCardFrames,
  args: {
    frames: [
      '/images/cinematic-studio/covers/light-golden.webp',
      '/images/cinematic-studio/covers/light-blue.webp',
      '/images/cinematic-studio/covers/light-neon.webp',
      '/images/cinematic-studio/covers/light-night.webp'
    ]
  },
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink p-8"><div class="group relative aspect-4/3 w-80 overflow-hidden rounded-2xl bg-hub-surface"><story /></div></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const CinematicStudio: Story = {}

export const Reshoot: Story = {
  args: {
    frames: [
      '/hero/angles/az000-0__eye-level-shot__medium-shot.webp',
      '/hero/angles/az045-0__eye-level-shot__medium-shot.webp',
      '/hero/angles/az090-0__eye-level-shot__medium-shot.webp',
      '/hero/angles/az135-0__eye-level-shot__medium-shot.webp'
    ]
  }
}
