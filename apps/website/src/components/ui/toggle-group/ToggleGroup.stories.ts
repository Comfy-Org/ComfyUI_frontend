import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import ToggleGroup from './ToggleGroup.vue'
import ToggleGroupItem from './ToggleGroupItem.vue'

const meta: Meta<typeof ToggleGroup> = {
  title: 'Website/UI/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs', 'stable'],
  render: (args) => ({
    components: { ToggleGroup, ToggleGroupItem },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: `
      <ToggleGroup v-bind="args" v-model="value">
        <ToggleGroupItem value="image" aria-label="Image">Image</ToggleGroupItem>
        <ToggleGroupItem value="video" aria-label="Video">Video</ToggleGroupItem>
        <ToggleGroupItem value="audio" aria-label="Audio">Audio</ToggleGroupItem>
      </ToggleGroup>
    `
  }),
  args: { type: 'single', modelValue: 'image' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const video = canvas.getByRole('button', { name: 'Video' })
    await userEvent.click(video)
    await expect(video).toHaveAttribute('data-state', 'on')
  }
}
export const Separated: Story = { args: { spacing: 2 } }
export const Multiple: Story = {
  args: { type: 'multiple', modelValue: ['image', 'video'] }
}
