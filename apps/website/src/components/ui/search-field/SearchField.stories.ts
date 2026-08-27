import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SearchField from './SearchField.vue'

const meta: Meta<typeof SearchField> = {
  title: 'Website/UI/SearchField',
  component: SearchField,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template:
        '<div class="bg-primary-comfy-ink max-w-3xl p-8"><story /></div>'
    })
  ],
  args: {
    label: 'Search workflows, models, and creators',
    placeholder: 'Search workflows, models, creators...'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithStatus: Story = {
  args: { status: '12 results' }
}
