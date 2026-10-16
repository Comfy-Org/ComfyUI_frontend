import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'

import BuildTargetMenu from './BuildTargetMenu.vue'

const meta: Meta<typeof BuildTargetMenu> = {
  title: 'Platform/Workflow/BuildTargetMenu',
  component: BuildTargetMenu,
  tags: ['autodocs'],
  args: { disabled: false, onDeploy: fn() }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
