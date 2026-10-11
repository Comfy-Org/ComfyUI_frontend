import type { Meta, StoryObj } from '@storybook/vue3-vite'

import HeaderMain from './HeaderMain.vue'

const meta: Meta<typeof HeaderMain> = {
  title: 'Website/Common/HeaderMain',
  component: HeaderMain,
  tags: ['autodocs', 'stable'],
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    githubStars: '95k'
  }
}

export const WithoutGitHubStars: Story = {}

export const Mobile: Story = {
  globals: {
    viewport: { value: 'mobile1', isRotated: false }
  }
}
