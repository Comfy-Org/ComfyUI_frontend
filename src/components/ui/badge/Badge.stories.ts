import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Badge from './Badge.vue'

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { value: 'Badge', variant: 'tag', severity: 'secondary' }
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const RemovableChip: Story = {
  args: { variant: 'chip', removable: true, value: 'Filter' }
}
export const Count: Story = { args: { variant: 'badge', value: 12 } }
export const Dot: Story = { args: { variant: 'dot', value: undefined } }
export const Severities: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex gap-2">
        <Badge severity="primary" value="Primary" />
        <Badge severity="secondary" value="Secondary" />
        <Badge severity="danger" value="Danger" />
        <Badge severity="info" value="Info" />
        <Badge severity="success" value="Success" />
        <Badge severity="warning" value="Warning" />
      </div>`
  })
}
