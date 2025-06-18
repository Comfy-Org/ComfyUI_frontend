<template>
  <div class="relative w-full p-6">
    <div class="h-12 flex items-center gap-1 justify-between">
      <div class="flex items-center w-5/12">
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
                class: 'w-full rounded-2xl'
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
      <PackInstallButton
        v-if="isMissingTab && missingNodePacks.length > 0"
        variant="black"
        :disabled="isLoading || !!error"
        :node-packs="missingNodePacks"
        :label="$t('manager.installAllMissingNodes')"
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
          :options="availableSortOptions"
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

import PackInstallButton from '@/components/dialog/content/manager/button/PackInstallButton.vue'
import SearchFilterDropdown from '@/components/dialog/content/manager/registrySearchBar/SearchFilterDropdown.vue'
import { useMissingNodes } from '@/composables/nodePack/useMissingNodes'
import {
  type SearchOption,
  SortableAlgoliaField
} from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'
import type {
  QuerySuggestion,
  SearchMode,
  SortableField
} from '@/types/searchServiceTypes'

const { searchResults, sortOptions } = defineProps<{
  searchResults?: components['schemas']['Node'][]
  suggestions?: QuerySuggestion[]
  sortOptions?: SortableField[]
  isMissingTab?: boolean
}>()

const searchQuery = defineModel<string>('searchQuery')
const searchMode = defineModel<SearchMode>('searchMode', { default: 'packs' })
const sortField = defineModel<string>('sortField', {
  default: SortableAlgoliaField.Downloads
})

const { t } = useI18n()

// Get missing node packs from workflow with loading and error states
const { missingNodePacks, isLoading, error } = useMissingNodes()

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
const filterOptions: SearchOption<SearchMode>[] = [
  { id: 'packs', label: t('manager.filter.nodePack') },
  { id: 'nodes', label: t('g.nodes') }
]

// When a dropdown query suggestion is selected, update the search query
const onOptionSelect = (event: AutoCompleteOptionSelectEvent) => {
  searchQuery.value = event.value.query
}
</script>
