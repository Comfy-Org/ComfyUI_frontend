// Template: a searchable list with its empty state, following
// reference/patterns/empty-states.md -- uses the real, shared
// NoResultsPlaceholder.vue (not a hand-rolled empty state), the same
// component real panels like the Assets/Workflows sidebar tabs use.
// SearchInput drives client-side filtering; typing something that matches
// nothing reveals the empty state for real.

import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'

const meta: Meta = {
  title: 'Templates/Empty State List',
  tags: ['autodocs']
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { SearchInput, NoResultsPlaceholder },
    setup() {
      const query = ref('')
      const items = [
        'flux-dev.safetensors',
        'sdxl-base.safetensors',
        'vae-ft-mse.safetensors',
        'clip-vit-l.safetensors'
      ]
      const filtered = computed(() =>
        items.filter((item) =>
          item.toLowerCase().includes(query.value.toLowerCase())
        )
      )
      return { query, filtered }
    },
    template: `
      <div class="mx-auto flex max-w-md flex-col gap-3 p-6">
        <SearchInput v-model="query" placeholder="Search models&hellip; (try &quot;xyz&quot;)" />
        <div v-if="filtered.length" class="flex flex-col gap-1">
          <div v-for="item in filtered" :key="item" class="rounded-lg border border-border-subtle px-3 py-2 text-sm">
            {{ item }}
          </div>
        </div>
        <NoResultsPlaceholder
          v-else
          icon="pi pi-search"
          title="No models found"
          message="Try a different search term."
        />
      </div>
    `
  })
}
