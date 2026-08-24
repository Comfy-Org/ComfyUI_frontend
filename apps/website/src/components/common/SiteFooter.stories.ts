import type { Meta, StoryObj } from '@storybook/vue3-vite'

import SiteFooter from './SiteFooter.vue'

const meta: Meta<typeof SiteFooter> = {
  title: 'Website/Common/SiteFooter',
  component: SiteFooter,
  tags: ['autodocs', 'needs-tests'],
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
