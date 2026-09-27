import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardArrow from './CardArrow.vue'

const meta: Meta<typeof CardArrow> = {
  title: 'Website/Common/CardArrow',
  component: CardArrow,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const GroupHover: Story = {
  args: {
    hover: 'group'
  },
  decorators: [
    () => ({
      template: `
        <div class="group flex items-center gap-4 rounded-3xl bg-transparency-white-t4 p-6 text-primary-comfy-canvas">
          <span>Hover this linked-card composition</span>
          <story />
        </div>
      `
    })
  ]
}

export const Compact: Story = {
  args: {
    class: 'size-8 rounded-xl'
  }
}
