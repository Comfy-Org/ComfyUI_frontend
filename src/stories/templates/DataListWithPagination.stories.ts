// Template: a searchable, paginated data table -- SearchInput + Table family
// + Pagination composed together, the shape used by model/secret list
// screens in the real app. Search filters client-side and resets to page 1;
// Pagination slices the filtered results.

import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref, watch } from 'vue'

import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import Pagination from '@/components/ui/pagination/Pagination.vue'

const ROWS = Array.from({ length: 23 }, (_, i) => ({
  name: `model-${String(i + 1).padStart(2, '0')}.safetensors`,
  size: `${(Math.random() * 8 + 1).toFixed(1)} GB`,
  modified: `${i + 1} day${i === 0 ? '' : 's'} ago`
}))

const meta: Meta = {
  title: 'Templates/Data List with Pagination',
  tags: ['autodocs']
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: {
      SearchInput,
      Table,
      TableHeader,
      TableBody,
      TableRow,
      TableHead,
      TableCell,
      Pagination
    },
    setup() {
      const query = ref('')
      const page = ref(1)
      const perPage = 8

      const filtered = computed(() =>
        ROWS.filter((row) =>
          row.name.toLowerCase().includes(query.value.toLowerCase())
        )
      )
      const paged = computed(() => {
        const start = (page.value - 1) * perPage
        return filtered.value.slice(start, start + perPage)
      })

      watch(query, () => {
        page.value = 1
      })

      return { query, page, perPage, filtered, paged }
    },
    template: `
      <div class="mx-auto flex max-w-2xl flex-col gap-3 p-6">
        <SearchInput v-model="query" placeholder="Search files&hellip;" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in paged" :key="row.name">
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.size }}</TableCell>
              <TableCell>{{ row.modified }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Pagination v-model:page="page" :total="filtered.length" :items-per-page="perPage" />
      </div>
    `
  })
}
