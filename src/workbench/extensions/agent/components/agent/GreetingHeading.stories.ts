import type { Meta, StoryObj } from '@storybook/vue3-vite'

import '../../agentPanel.css'

import GreetingHeading from './GreetingHeading.vue'

const meta: Meta<typeof GreetingHeading> = {
  title: 'Agent/GreetingHeading',
  component: GreetingHeading,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { userName: 'Jo', title: 'What do you want to make?' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope @container flex w-100 justify-center bg-base-background p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutName: Story = {
  args: { userName: undefined }
}

export const LongTitle: Story = {
  args: { title: 'This workflow has an unconnected input.' }
}
