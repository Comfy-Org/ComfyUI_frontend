import type { Meta, StoryObj } from '@storybook/vue3-vite'

import StatusBadge from './StatusBadge.vue'

const meta = {
  title: 'Components/Badges/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    severity: {
      control: 'select',
      options: ['default', 'secondary', 'warn', 'danger', 'contrast']
    },
    variant: {
      control: 'select',
      options: ['label', 'dot', 'circle']
    }
  },
  args: {
    label: 'NEW',
    severity: 'default'
  }
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Secondary: Story = {
  args: {
    label: 'NEW',
    severity: 'secondary'
  }
}

export const Warn: Story = {
  args: {
    label: 'NEW',
    severity: 'warn'
  }
}

export const Danger: Story = {
  args: {
    label: 'NEW',
    severity: 'danger'
  }
}

export const Contrast: Story = {
  args: {
    label: 'NEW',
    severity: 'contrast'
  }
}

export const Circle: Story = {
  args: {
    label: '3',
    variant: 'circle'
  }
}

export const AllSeveritiesLabel: Story = {
  render: () => ({
    components: { StatusBadge },
    template: `
      <div class="flex items-center gap-2">
        <StatusBadge label="NEW" severity="default" />
        <StatusBadge label="NEW" severity="secondary" />
        <StatusBadge label="NEW" severity="warn" />
        <StatusBadge label="NEW" severity="danger" />
        <StatusBadge label="NEW" severity="contrast" />
      </div>
    `
  })
}

export const AllSeveritiesDot: Story = {
  render: () => ({
    components: { StatusBadge },
    template: `
      <div class="flex items-center gap-2">
        <StatusBadge variant="dot" severity="default" />
        <StatusBadge variant="dot" severity="secondary" />
        <StatusBadge variant="dot" severity="warn" />
        <StatusBadge variant="dot" severity="danger" />
        <StatusBadge variant="dot" severity="contrast" />
      </div>
    `
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { StatusBadge },
    template: `
      <div class="flex items-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <StatusBadge label="NEW" variant="label" />
          <span class="text-xs text-muted">label</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <StatusBadge variant="dot" severity="danger" />
          <span class="text-xs text-muted">dot</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <StatusBadge label="5" variant="circle" />
          <span class="text-xs text-muted">circle</span>
        </div>
      </div>
    `
  })
}
