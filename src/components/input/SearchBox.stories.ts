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
    },
    showBorder: {
      control: 'boolean',
      description: 'Toggle border prop'
    }
  },
  args: {
    placeHolder: 'Search...',
    showBorder: false
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
      <div style="max-width: 320px;">
        <SearchBox v-bind="args" v-model="searchText" />
      </div>
    `
  })
}

export const WithBorder: Story = {
  ...Default,
  args: {
    showBorder: true
  }
}

export const NoBorder: Story = {
  ...Default,
  args: {
    showBorder: false
  }
}
