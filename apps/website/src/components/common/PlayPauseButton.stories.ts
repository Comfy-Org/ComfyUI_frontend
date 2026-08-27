import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PlayPauseButton from './PlayPauseButton.vue'

const meta: Meta<typeof PlayPauseButton> = {
  title: 'Website/Common/PlayPauseButton',
  component: PlayPauseButton,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink flex items-center gap-6 p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Play: Story = {
  render: (args) => ({
    components: { PlayPauseButton },
    setup: () => ({ args }),
    template: '<PlayPauseButton v-bind="args" aria-label="Play" />'
  })
}

export const Pause: Story = {
  args: {
    playing: true
  },
  render: (args) => ({
    components: { PlayPauseButton },
    setup: () => ({ args }),
    template: '<PlayPauseButton v-bind="args" aria-label="Pause" />'
  })
}

export const Small: Story = {
  args: {
    size: 'sm'
  },
  render: (args) => ({
    components: { PlayPauseButton },
    setup: () => ({ args }),
    template: '<PlayPauseButton v-bind="args" aria-label="Play" />'
  })
}
