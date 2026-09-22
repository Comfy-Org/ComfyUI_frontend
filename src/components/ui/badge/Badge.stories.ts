import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'

import Badge from './Badge.vue'

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { default: 'Badge', variant: 'tag', severity: 'secondary' },
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<Badge v-bind="args">{{ args.default }}</Badge>'
  })
} satisfies Meta<ComponentPropsAndSlots<typeof Badge>>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const RemovableChip: Story = {
  args: { variant: 'chip', removable: true, default: 'Filter' }
}
export const Count: Story = { args: { variant: 'badge', default: '12' } }
export const Dot: Story = { args: { variant: 'dot', default: '' } }
export const Severities: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex gap-2">
        <Badge severity="primary">Primary</Badge>
        <Badge severity="secondary">Secondary</Badge>
        <Badge severity="danger">Danger</Badge>
        <Badge severity="info">Info</Badge>
        <Badge severity="success">Success</Badge>
        <Badge severity="warning">Warning</Badge>
      </div>`
  })
}
