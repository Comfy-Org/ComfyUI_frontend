import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Download, ExternalLink, Heart } from 'lucide-vue-next'

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
    components: { IconGroup, IconButton, Download, ExternalLink, Heart },
    template: `
      <IconGroup>
        <IconButton @click="console.log('Hello World!!')">
          <Heart :size="16" />
        </IconButton>
        <IconButton @click="console.log('Hello World!!')">
          <Download :size="16" />
        </IconButton>
        <IconButton @click="console.log('Hello World!!')">
          <ExternalLink :size="16" />
        </IconButton>
      </IconGroup>
    `
  })
}
