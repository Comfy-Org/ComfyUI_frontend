import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Spinner from './Spinner.vue'

const meta: Meta<typeof Spinner> = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  args: { loadingLabel: 'Loading' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Sizes: Story = {
  render: () => ({
    components: { Spinner },
    template: `
      <div class="flex items-center gap-4">
        <Spinner class="size-4" loading-label="Loading" />
        <Spinner class="size-8" loading-label="Loading" />
        <Spinner class="size-12" loading-label="Loading" />
      </div>`
  })
}
