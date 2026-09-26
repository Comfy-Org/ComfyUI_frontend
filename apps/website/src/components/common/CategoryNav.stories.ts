import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import CategoryNav from './CategoryNav.vue'

const categories = [
  { label: 'All', value: 'all' },
  { label: 'Image', value: 'image' },
  { label: 'Video', value: 'video' },
  { label: 'Audio', value: 'audio' }
]

const meta: Meta<typeof CategoryNav> = {
  title: 'Website/Common/CategoryNav',
  component: CategoryNav,
  tags: ['autodocs', 'stable'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ],
  args: {
    categories,
    modelValue: 'all',
    'onUpdate:modelValue': fn()
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const imageButton = canvas.getByRole('button', { name: 'Image' })

    await userEvent.click(imageButton)
    await expect(args['onUpdate:modelValue']).toHaveBeenCalledWith('image')
  }
}

export const SelectedVideo: Story = {
  args: {
    modelValue: 'video'
  }
}
