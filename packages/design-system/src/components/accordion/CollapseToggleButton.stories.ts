import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref, toRefs } from 'vue'

import CollapseToggleButton from './CollapseToggleButton.vue'

const meta: Meta<typeof CollapseToggleButton> = {
  title: 'Components/Accordion/CollapseToggleButton',
  component: CollapseToggleButton,
  tags: ['autodocs'],
  args: {
    show: true,
    expandLabel: 'Expand all',
    collapseLabel: 'Collapse all',
    'onUpdate:modelValue': fn()
  },
  render: (args) => ({
    components: { CollapseToggleButton },
    setup() {
      const isAllCollapsed = ref(false)
      function onUpdate(value: boolean) {
        isAllCollapsed.value = value
        args['onUpdate:modelValue']?.(value)
      }
      return { isAllCollapsed, onUpdate, ...toRefs(args) }
    },
    template:
      '<div class="flex items-center"><span>Sections</span><CollapseToggleButton :model-value="isAllCollapsed" :show="show" :expand-label="expandLabel" :collapse-label="collapseLabel" @update:model-value="onUpdate" /></div>'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
