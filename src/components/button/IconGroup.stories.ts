import type { Meta, StoryObj } from '@storybook/vue3-vite'

import IconButton from './IconButton.vue'
import IconGroup from './IconGroup.vue'

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
    components: { IconGroup, IconButton },
    template: `
      <IconGroup>
        <IconButton @click="console.log('Hello World!!')">
          <i class="icon-[lucide--heart] size-4" />
        </IconButton>
        <IconButton @click="console.log('Hello World!!')">
          <i class="icon-[lucide--download] size-4" />
        </IconButton>
        <IconButton @click="console.log('Hello World!!')">
          <i class="icon-[lucide--external-link] size-4" />
        </IconButton>
      </IconGroup>
    `
  })
}
