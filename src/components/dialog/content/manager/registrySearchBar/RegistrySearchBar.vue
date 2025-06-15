<template>
  <div class="relative w-full p-6">
    <div class="flex items-center w-full">
      <AutoComplete
        v-model.lazy="searchQuery"
        :suggestions="suggestions || []"
        :placeholder="$t('manager.searchPlaceholder')"
        :complete-on-focus="false"
        :delay="8"
        option-label="query"
        class="w-full"
        :pt="{
          pcInputText: {
            root: {
              autofocus: true,
              class: 'w-5/12 rounded-2xl'
            }
          },
          loader: {
            style: 'display: none'
          }
        }"
        :show-empty-message="false"
        @complete="stubTrue"
        @option-select="onOptionSelect"
      />
    </div>
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between mt-3 text-sm">
        <div class="flex gap-6 ml-1">
          <SearchFilterDropdown
            v-model:modelValue="searchMode"
            :options="searchModeOptions"
            :label="$t('g.filter')"
          />
          <SearchFilterDropdown
            v-model:modelValue="sortField"
            :options="availableSortOptions"
            :label="$t('g.sort')"
          />
        </div>
        <div class="flex items-center gap-4 mr-6">
          <small v-if="hasResults" class="text-color-secondary">
            {{ $t('g.resultsCount', { count: searchResults?.length || 0 }) }}
          </small>
        </div>
      </div>
      <!-- Add search refinement dropdowns if provider supports them -->
      <div v-if="filterOptions?.length" class="flex gap-3 ml-1 text-sm">
        <template v-for="filterOption in filterOptions" :key="filterOption.id">
          <div class="flex items-center gap-1">
            <span class="text-muted">{{ filterOption.label }}:</span>
            <Dropdown
              v-if="filterOption.type === 'single-select'"
              :model-value="selectedFilters[filterOption.id] as string"
              :options="filterOption.options || []"
              option-label="label"
              option-value="value"
              placeholder="Any"
              :show-clear="true"
              class="min-w-[6rem] border-none bg-transparent shadow-none"
              :pt="{
                input: { class: 'py-0 px-1 border-none' },
                trigger: { class: 'hidden' },
                panel: { class: 'shadow-md' },
                item: { class: 'py-2 px-3 text-sm' }
              }"
              @update:model-value="
                $event
                  ? (selectedFilters[filterOption.id] = $event)
                  : delete selectedFilters[filterOption.id]
              "
            />
            <MultiSelect
              v-else-if="filterOption.type === 'multi-select'"
              :model-value="selectedFilters[filterOption.id] as string[]"
              :options="filterOption.options || []"
              option-label="label"
              option-value="value"
              display="chip"
              class="min-w-[6rem] border-none bg-transparent shadow-none"
              :pt="{
                input: { class: 'py-0 px-1 border-none' },
                trigger: { class: 'hidden' },
                panel: { class: 'shadow-md' },
                item: { class: 'py-2 px-3 text-sm' },
                label: { class: 'py-0 px-1 text-sm' },
                header: { class: 'p-2' },
                filterInput: { class: 'text-sm' },
                emptyMessage: { class: 'text-sm text-muted p-3' }
              }"
              @update:model-value="
                $event?.length > 0
                  ? (selectedFilters[filterOption.id] = $event)
                  : delete selectedFilters[filterOption.id]
              "
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { stubTrue } from 'lodash'
import AutoComplete, {
  AutoCompleteOptionSelectEvent
} from 'primevue/autocomplete'
import Dropdown from 'primevue/dropdown'
import MultiSelect from 'primevue/multiselect'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchFilterDropdown from '@/components/dialog/content/manager/registrySearchBar/SearchFilterDropdown.vue'
import { type SearchOption } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'
import type {
  ActiveFilters,
  QuerySuggestion,
  SearchFilter,
  SearchMode,
  SortableField
} from '@/types/searchServiceTypes'

const { searchResults, sortOptions, filterOptions } = defineProps<{
  searchResults?: components['schemas']['Node'][]
  suggestions?: QuerySuggestion[]
  sortOptions?: SortableField[]
  filterOptions?: SearchFilter[]
}>()

const searchQuery = defineModel<string>('searchQuery')
const searchMode = defineModel<SearchMode>('searchMode', { default: 'packs' })
const sortField = defineModel<string>('sortField', {
  default: 'total_install'
})
const selectedFilters = defineModel<ActiveFilters>('activeFilters', {
  default: () => ({})
})

const { t } = useI18n()

const hasResults = computed(
  () => searchQuery.value?.trim() && searchResults?.length
)

const availableSortOptions = computed<SearchOption<string>[]>(() => {
  if (!sortOptions) return []
  return sortOptions.map((field) => ({
    id: field.id,
    label: field.label
  }))
})
const searchModeOptions: SearchOption<SearchMode>[] = [
  { id: 'packs', label: t('manager.filter.nodePack') },
  { id: 'nodes', label: t('g.nodes') }
]

// When a dropdown query suggestion is selected, update the search query
const onOptionSelect = (event: AutoCompleteOptionSelectEvent) => {
  searchQuery.value = event.value.query
}
</script>
