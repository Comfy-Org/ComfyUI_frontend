import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Spinner from './Spinner.vue'

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs']
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Sizes: Story = {
  render: () => ({
    components: { Spinner },
    template: `
      <div class="flex items-center gap-4">
        <Spinner class="size-4" aria-label="Loading" />
        <Spinner class="size-8" aria-label="Loading" />
        <Spinner class="size-12" aria-label="Loading" />
      </div>`
  })
}
