<template>
  <div class="relative w-full p-6">
    <div class="flex items-center w-full">
      <IconField class="w-5/12">
        <InputIcon class="pi pi-search" />
        <InputText
          :model-value="searchQuery"
          @update:model-value="$emit('update:searchQuery', $event)"
          :placeholder="$t('manager.searchPlaceholder')"
          class="w-full rounded-2xl"
          autofocus
        />
      </IconField>
    </div>
    <div class="flex mt-3 text-sm">
      <div class="flex gap-6 ml-1">
        <SearchFilterDropdown
          v-model="currentFilter"
          :options="filterOptions"
          :label="$t('g.filter')"
          @update:model-value="handleFilterChange"
        />
        <SearchFilterDropdown
          v-model="currentSort"
          :options="sortOptions"
          :label="$t('g.sort')"
          @update:model-value="handleSortChange"
        />
      </div>
      <div class="flex items-center gap-4 ml-6">
        <small v-if="hasResults" class="text-color-secondary">
          {{ $t('g.resultsCount', { count: searchResults.length }) }}
        </small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchFilterDropdown from '@/components/dialog/content/manager/registrySearchBar/SearchFilterDropdown.vue'
import type { NodeField, SearchOption } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const DEFAULT_SORT: NodeField = 'downloads'
const DEFAULT_FILTER = 'nodePack'

const props = defineProps<{
  searchQuery: string
  searchResults?: components['schemas']['Node'][]
}>()

const { t } = useI18n()

const currentSort = ref<NodeField>(DEFAULT_SORT)
const currentFilter = ref<string>(DEFAULT_FILTER)

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:sortBy': [value: NodeField]
  'update:filterBy': [value: string]
}>()

const hasResults = computed(
  () => props.searchQuery.trim() && props.searchResults?.length
)

const sortOptions: SearchOption<NodeField>[] = [
  { id: 'downloads', label: t('manager.sort.downloads') },
  { id: 'name', label: t('g.name') },
  { id: 'rating', label: t('manager.sort.rating') },
  { id: 'category', label: t('g.category') }
]
const filterOptions: SearchOption<string>[] = [
  { id: 'nodePack', label: t('manager.filter.nodePack') },
  { id: 'node', label: t('g.nodes') }
]

const handleSortChange = () => {
  // TODO: emit to Algolia service
  emit('update:sortBy', currentSort.value)
}
const handleFilterChange = () => {
  // TODO: emit to Algolia service
  emit('update:filterBy', currentFilter.value)
}
</script>
