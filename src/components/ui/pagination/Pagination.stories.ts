import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Pagination from './Pagination.vue'

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  args: { total: 240 },
  argTypes: {
    total: { control: 'number' },
    withEdgeButtons: { control: 'boolean' }
  },
  render: (args) => ({
    components: { Pagination },
    setup: () => ({ args, page: ref(1), itemsPerPage: ref(25) }),
    template:
      '<Pagination v-bind="args" v-model:page="page" v-model:items-per-page="itemsPerPage" />'
  })
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithPageSize: Story = {
  args: { itemsPerPageOptions: [25, 50, 100] }
}

export const WithEdgeButtons: Story = {
  args: { withEdgeButtons: true }
}

export const WithPageSizeAndEdgeButtons: Story = {
  args: { itemsPerPageOptions: [25, 50, 100], withEdgeButtons: true }
}
