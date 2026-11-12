import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, toRefs } from 'vue'

import CollapseToggleButton from './CollapseToggleButton.vue'

const meta: Meta<typeof CollapseToggleButton> = {
  title: 'Components/Accordion/CollapseToggleButton',
  component: CollapseToggleButton,
  tags: ['autodocs'],
  args: {
    show: true,
    expandLabel: 'Expand all',
    collapseLabel: 'Collapse all'
  },
  render: (args) => ({
    components: { CollapseToggleButton },
    setup() {
      const isAllCollapsed = ref(false)
      return { isAllCollapsed, ...toRefs(args) }
    },
    template:
      '<div class="flex items-center"><span>Sections</span><CollapseToggleButton v-model="isAllCollapsed" :show="show" :expand-label="expandLabel" :collapse-label="collapseLabel" /></div>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
