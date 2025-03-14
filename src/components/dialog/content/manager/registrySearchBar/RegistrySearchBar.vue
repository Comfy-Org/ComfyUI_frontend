<template>
  <div class="relative w-full p-6">
    <div class="flex items-center w-full">
      <AutoComplete
        v-model.lazy="searchQuery"
        :suggestions="suggestions || []"
        :placeholder="$t('manager.searchPlaceholder')"
        :complete-on-focus="false"
        :delay="8"
        optionLabel="query"
        class="w-full"
        @complete="stubTrue"
        @option-select="onOptionSelect"
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
      >
      </AutoComplete>
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
import type { NodesIndexSuggestion } from '@/services/algoliaSearchService'
import type { PackField, SearchOption } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const { searchResults } = defineProps<{
  searchResults?: components['schemas']['Node'][]
  suggestions?: NodesIndexSuggestion[]
}>()

const searchQuery = defineModel<string>('searchQuery')
const searchMode = defineModel<string>('searchMode', { default: 'packs' })
const sortField = defineModel<PackField>('sortField', { default: 'downloads' })

const { t } = useI18n()

const hasResults = computed(
  () => searchQuery.value?.trim() && searchResults?.length
)

const sortOptions: SearchOption<PackField>[] = [
  { id: 'downloads', label: t('manager.sort.downloads') },
  { id: 'name', label: t('g.name') },
  { id: 'rating', label: t('manager.sort.rating') },
  { id: 'category', label: t('g.category') }
]
const filterOptions: SearchOption<string>[] = [
  { id: 'packs', label: t('manager.filter.nodePack') },
  { id: 'nodes', label: t('g.nodes') }
]

const onOptionSelect = (event: AutoCompleteOptionSelectEvent) => {
  searchQuery.value = event.value.query
}
</script>
