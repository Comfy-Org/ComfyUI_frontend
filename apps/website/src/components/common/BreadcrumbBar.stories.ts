import type { Meta, StoryObj } from '@storybook/vue3-vite'

import BreadcrumbBar from './BreadcrumbBar.vue'

const meta: Meta<typeof BreadcrumbBar> = {
  title: 'Website/Common/BreadcrumbBar',
  component: BreadcrumbBar,
  tags: ['autodocs'],
  args: {
    crumbs: [
      { label: 'Home', href: '#' },
      { label: 'Learning', href: '#' },
      { label: 'Comfy MCP' }
    ],
    updated: 'Updated August 2026'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutUpdatedDate: Story = {
  args: {
    updated: undefined
  }
}

export const LongTrail: Story = {
  args: {
    crumbs: [
      { label: 'Home', href: '#' },
      { label: 'Resources', href: '#' },
      { label: 'Learning', href: '#' },
      { label: 'Workflow automation with Comfy MCP' }
    ]
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
