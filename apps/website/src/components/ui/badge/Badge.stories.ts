import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Badge from './Badge.vue'

const meta: Meta<typeof Badge> = {
  title: 'Website/UI/Badge',
  component: Badge,
  tags: ['autodocs', 'stable'],
  args: { default: 'New' },
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<Badge v-bind="args">{{ args.default }}</Badge>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Subtle: Story = { args: { variant: 'subtle' } }
export const Category: Story = {
  args: { variant: 'category', default: 'Models' }
}
export const Accent: Story = {
  args: { variant: 'accent', default: 'Available now' }
}
export const Callout: Story = {
  args: { variant: 'callout', default: 'Featured' }
}
export const ExtraSmall: Story = { args: { size: 'xs' } }
