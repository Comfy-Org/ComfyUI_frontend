import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import Table from '@comfyorg/design-system/table/Table'
import TableBody from '@comfyorg/design-system/table/TableBody'
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableHead from '@comfyorg/design-system/table/TableHead'
import TableHeader from '@comfyorg/design-system/table/TableHeader'
import TableRow from '@comfyorg/design-system/table/TableRow'
import TableSortHead from './TableSortHead.vue'
import type { TableSortDirection } from './tableUtils'
import { sortByText } from './tableUtils'

const rows = [
  { name: 'Load Checkpoint', category: 'loaders' },
  { name: 'KSampler', category: 'sampling' },
  { name: 'VAE Decode', category: 'latent' }
]

const meta = {
  title: 'Components/Table/TableSortHead',
  component: TableSortHead,
  tags: ['autodocs']
} satisfies Meta<typeof TableSortHead>

export default meta
type Story = StoryObj<typeof meta>

function renderTable(initialDirection: TableSortDirection | null) {
  return () => ({
    components: {
      Table,
      TableBody,
      TableCell,
      TableHead,
      TableHeader,
      TableRow,
      TableSortHead
    },
    setup() {
      const direction = ref(initialDirection)
      const sortedRows = computed(() =>
        sortByText(rows, direction.value, (row) => row.name)
      )
      return { direction, sortedRows }
    },
    template: `
      <Table class="w-96 rounded-lg border border-border">
        <TableHeader>
          <TableRow>
            <TableSortHead v-model:direction="direction">Name</TableSortHead>
            <TableHead>Category</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in sortedRows" :key="row.name">
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>{{ row.category }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    `
  })
}

export const Default: Story = { render: renderTable(null) }
export const Ascending: Story = { render: renderTable('ascending') }
export const Descending: Story = { render: renderTable('descending') }
