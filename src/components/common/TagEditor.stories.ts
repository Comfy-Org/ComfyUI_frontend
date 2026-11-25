import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import TagEditor from './TagEditor.vue'

const meta: Meta<typeof TagEditor> = {
  title: 'Components/TagEditor',
  component: TagEditor,
  tags: ['autodocs'],
  args: {
    disabled: false,
    alwaysEditing: false,
    placeholder: 'Add tag'
  },
  render: (args) => ({
    components: { TagEditor },
    setup() {
      const tags = ref(['Vue', 'TypeScript'])
      return { args, tags }
    },
    template: '<TagEditor v-bind="args" v-model="tags" class="w-80" />'
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
