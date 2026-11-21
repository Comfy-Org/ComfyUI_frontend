import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Skeleton from './Skeleton.vue'

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  args: { class: 'h-4 w-48' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CardPlaceholder: Story = {
  render: () => ({
    components: { Skeleton },
    template: `
      <div class="flex w-80 items-center gap-3">
        <Skeleton class="size-10 rounded-full" />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton class="h-4 w-3/5" />
          <Skeleton class="h-3 w-full" />
        </div>
      </div>`
  })
}
