import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@/components/ui/button/Button.vue'

import Tooltip from './Tooltip.vue'

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Button, Tooltip },
    template: `
      <Tooltip config="Add to library">
        <Button variant="secondary">Hover or focus</Button>
      </Tooltip>
    `
  })
}

export const Disabled: Story = {
  render: () => ({
    components: { Button, Tooltip },
    template: `
      <Tooltip :config="{ value: 'Unavailable', disabled: true }">
        <Button variant="secondary" disabled>Disabled</Button>
      </Tooltip>
    `
  })
}

export const Bottom: Story = {
  render: () => ({
    components: { Button, Tooltip },
    template: `
      <Tooltip config="Below the trigger" side="bottom">
        <Button variant="secondary">Bottom</Button>
      </Tooltip>
    `
  })
}
