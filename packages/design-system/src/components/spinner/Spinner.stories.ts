import type { Meta, StoryObj } from '@storybook/vue3-vite'
import type { SVGAttributes } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import Spinner from './Spinner.vue'

const meta: Meta<
  ComponentProps<typeof Spinner> & Pick<SVGAttributes, 'aria-label'>
> = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  args: { 'aria-label': 'Loading' }
}

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
