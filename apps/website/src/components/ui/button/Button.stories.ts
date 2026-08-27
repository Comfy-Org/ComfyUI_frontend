import { ArrowRight } from '@lucide/vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import Button from './Button.vue'

const meta: Meta<typeof Button> = {
  title: 'Website/UI/Button',
  component: Button,
  tags: ['autodocs', 'stable'],
  args: { default: 'Get started' },
  render: (args) => ({
    components: { ArrowRight, Button },
    setup: () => ({ args }),
    template:
      '<Button v-bind="args"><template #default>{{ args.default }}</template><template v-if="args.appendIcon" #append><ArrowRight /></template></Button>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button')
    button.focus()
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
  }
}
export const Outline: Story = { args: { variant: 'outline' } }
export const Link: Story = { args: { variant: 'link', href: '#button-link' } }
export const WithIcon: Story = { args: { appendIcon: ArrowRight } }
export const Disabled: Story = { args: { disabled: true } }
export const Large: Story = { args: { size: 'lg' } }
