import type {
  ComponentPropsAndSlots,
  Meta,
  StoryObj
} from '@storybook/vue3-vite'

import Badge from './Badge.vue'

const meta: Meta<ComponentPropsAndSlots<typeof Badge>> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    default: 'Badge',
    variant: 'tag',
    severity: 'secondary',
    removeLabel: 'Remove'
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'tag',
        'chip',
        'badge',
        'compact',
        'label',
        'circle',
        'outline',
        'square',
        'pill',
        'dot'
      ]
    },
    severity: {
      control: 'select',
      options: [
        'default',
        'contrast',
        'primary',
        'secondary',
        'muted',
        'danger',
        'info',
        'success',
        'warning'
      ]
    }
  },
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<Badge v-bind="args">{{ args.default }}</Badge>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const RemovableChip: Story = {
  args: { variant: 'chip', removable: true, default: 'Filter' }
}
export const Count: Story = { args: { variant: 'badge', default: '12' } }
export const Dot: Story = { args: { variant: 'dot', default: '' } }
export const Compact: Story = {
  args: { variant: 'compact', default: 'Downloaded' }
}
export const Severities: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex gap-2">
        <Badge severity="primary" remove-label="Remove">Primary</Badge>
        <Badge severity="secondary" remove-label="Remove">Secondary</Badge>
        <Badge severity="danger" remove-label="Remove">Danger</Badge>
        <Badge severity="info" remove-label="Remove">Info</Badge>
        <Badge severity="success" remove-label="Remove">Success</Badge>
        <Badge severity="warning" remove-label="Remove">Warning</Badge>
      </div>`
  })
}
