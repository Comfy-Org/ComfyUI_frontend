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
    <div class="flex mt-3 text-sm">
      <div class="flex gap-6 ml-1">
        <SearchFilterDropdown
          v-model:modelValue="searchMode"
          :options="filterOptions"
          :label="$t('g.filter')"
        />
        <SearchFilterDropdown
          v-model:modelValue="sortField"
          :options="sortOptions"
          :label="$t('g.sort')"
        />
      </div>
      <div class="flex items-center gap-4 ml-6">
        <small v-if="hasResults" class="text-color-secondary">
          {{ $t('g.resultsCount', { count: searchResults?.length || 0 }) }}
        </small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { stubTrue } from 'lodash'
import AutoComplete, {
  AutoCompleteOptionSelectEvent
} from 'primevue/autocomplete'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchFilterDropdown from '@/components/dialog/content/manager/registrySearchBar/SearchFilterDropdown.vue'
import type { NodesIndexSuggestion } from '@/types/algoliaTypes'
import {
  type SearchOption,
  SortableAlgoliaField
} from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const { searchResults } = defineProps<{
  searchResults?: components['schemas']['Node'][]
  suggestions?: NodesIndexSuggestion[]
}>()

const searchQuery = defineModel<string>('searchQuery')
const searchMode = defineModel<string>('searchMode', { default: 'packs' })
const sortField = defineModel<SortableAlgoliaField>('sortField', {
  default: SortableAlgoliaField.Downloads
})

const { t } = useI18n()

const hasResults = computed(
  () => searchQuery.value?.trim() && searchResults?.length
)

const sortOptions: SearchOption<SortableAlgoliaField>[] = [
  { id: SortableAlgoliaField.Downloads, label: t('manager.sort.downloads') },
  { id: SortableAlgoliaField.Created, label: t('manager.sort.created') },
  { id: SortableAlgoliaField.Updated, label: t('manager.sort.updated') },
  { id: SortableAlgoliaField.Publisher, label: t('manager.sort.publisher') },
  { id: SortableAlgoliaField.Name, label: t('g.name') }
]
const filterOptions: SearchOption<string>[] = [
  { id: 'packs', label: t('manager.filter.nodePack') },
  { id: 'nodes', label: t('g.nodes') }
]

const onOptionSelect = (event: AutoCompleteOptionSelectEvent) => {
  searchQuery.value = event.value.query
}
</script>
