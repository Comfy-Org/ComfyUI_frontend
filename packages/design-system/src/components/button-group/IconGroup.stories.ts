import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Button from '@comfyorg/design-system/button/Button'
import IconGroup from '@comfyorg/design-system/button-group/IconGroup'

const meta: Meta<typeof IconGroup> = {
  title: 'Components/Button/IconGroup',
  component: IconGroup,
  parameters: {
    layout: 'centered'
  }
}
export default meta

type Story = StoryObj<typeof IconGroup>

export const Basic: Story = {
  render: () => ({
    components: { IconGroup, Button },
    template: `
      <IconGroup>
        <Button size="icon" @click="console.log('Hello World!!')">
          <i class="icon-[lucide--heart]" />
        </Button>
        <Button size="icon" @click="console.log('Hello World!!')">
          <i class="icon-[lucide--download]" />
        </Button>
        <Button size="icon" @click="console.log('Hello World!!')">
          <i class="icon-[lucide--external-link]" />
        </Button>
      </IconGroup>
    `
  })
}
