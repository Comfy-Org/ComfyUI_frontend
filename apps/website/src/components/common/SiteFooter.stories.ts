import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import SiteFooter from './SiteFooter.vue'

const meta: Meta<typeof SiteFooter> = {
  title: 'Website/Common/SiteFooter',
  component: SiteFooter,
  tags: ['autodocs', 'stable'],
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('contentinfo')).toBeVisible()
    await expect(
      canvas.getByRole('navigation', { name: 'Products' })
    ).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'rel',
      'noopener'
    )
  }
}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
