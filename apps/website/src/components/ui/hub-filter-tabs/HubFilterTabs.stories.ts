import { Box, Image, LayoutGrid, Video } from '@lucide/vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import HubFilterTabs from './HubFilterTabs.vue'

const meta: Meta<typeof HubFilterTabs> = {
  title: 'Website/UI/HubFilterTabs',
  component: HubFilterTabs,
  tags: ['autodocs'],
  decorators: [
    () => ({
      template: '<div class="bg-primary-comfy-ink p-8"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { HubFilterTabs },
    setup() {
      const selection = ref('all')
      const items = [
        { value: 'all', label: 'ALL', icon: LayoutGrid },
        { value: 'image', label: 'Image', icon: Image },
        { value: 'video', label: 'Video', icon: Video },
        { value: '3d', label: '3D', icon: Box }
      ]
      return { items, selection }
    },
    template:
      '<HubFilterTabs v-model="selection" label="Model categories" :items="items" />'
  })
}
