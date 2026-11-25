import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppSpinner from './AppSpinner.vue'

const meta: Meta<typeof AppSpinner> = {
  title: 'Components/AppSpinner',
  component: AppSpinner,
  tags: ['autodocs'],
  args: { variant: 'ring', label: false },
  argTypes: {
    variant: { control: 'select', options: ['ring', 'dots'] }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AllVariants: Story = {
  render: () => ({
    components: { AppSpinner },
    template: `
      <div class="grid grid-cols-2 items-center gap-8 p-8">
        <AppSpinner />
        <AppSpinner label />
        <AppSpinner variant="dots" />
        <AppSpinner variant="dots" label />
      </div>`
  })
}
