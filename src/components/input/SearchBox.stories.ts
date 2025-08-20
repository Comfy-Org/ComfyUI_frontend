import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import SearchBox from './SearchBox.vue'

const meta: Meta<typeof SearchBox> = {
  title: 'Components/Input/SearchBox',
  component: SearchBox,
  tags: ['autodocs'],
  argTypes: {
    placeHolder: {
      control: 'text'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { SearchBox },
    setup() {
      const searchText = ref('')
      return { searchText, args }
    },
    template: `
      <div>
        <SearchBox v-model:="searchQuery" />
      </div>
    `
  })
}
