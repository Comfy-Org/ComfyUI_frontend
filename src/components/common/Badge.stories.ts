import { t } from '@/i18n'
import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Badge from './Badge.vue'

const meta = {
  title: 'Components/Badges/Badge',
  component: Badge,
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
    label: t('g.new'),
    severity: 'default'
  }
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Secondary: Story = {
  args: {
    label: t('g.new'),
    severity: 'secondary'
  }
}

export const Warn: Story = {
  args: {
    label: t('g.new'),
    severity: 'warn'
  }
}

export const Danger: Story = {
  args: {
    label: t('g.new'),
    severity: 'danger'
  }
}

export const Contrast: Story = {
  args: {
    label: t('g.new'),
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
    components: { Badge },
    setup() {
      return { t }
    },
    template: `
      <div class="flex items-center gap-2">
        <Badge :label="t('g.new')" severity="default" />
        <Badge :label="t('g.new')" severity="secondary" />
        <Badge :label="t('g.new')" severity="warn" />
        <Badge :label="t('g.new')" severity="danger" />
        <Badge :label="t('g.new')" severity="contrast" />
      </div>
    `
  })
}

export const AllSeveritiesDot: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex items-center gap-2">
        <Badge variant="dot" severity="default" />
        <Badge variant="dot" severity="secondary" />
        <Badge variant="dot" severity="warn" />
        <Badge variant="dot" severity="danger" />
        <Badge variant="dot" severity="contrast" />
      </div>
    `
  })
}

export const AllVariants: Story = {
  render: () => ({
    components: { Badge },
    setup() {
      return { t }
    },
    template: `
      <div class="flex items-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <Badge :label="t('g.new')" variant="label" />
          <span class="text-xs text-muted-foreground">{{ t('g.variant_label') }}</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Badge variant="dot" severity="danger" />
          <span class="text-xs text-muted-foreground">{{ t('g.variant_dot') }}</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <Badge label="5" variant="circle" />
          <span class="text-xs text-muted-foreground">{{ t('g.variant_circle') }}</span>
        </div>
      </div>
    `
  })
}