<template>
  <div class="relative w-full p-6">
    <div class="flex h-12 items-center justify-between gap-1">
      <div class="flex w-5/12 items-center">
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
        :disabled="isLoading || !!error"
        :node-packs="missingNodePacks"
        :label="$t('manager.installAllMissingNodes')"
      />
      <PackUpdateButton
        v-if="isUpdateAvailableTab && hasUpdateAvailable"
        :node-packs="enabledUpdateAvailableNodePacks"
        :has-disabled-update-packs="hasDisabledUpdatePacks"
      />
    </div>
    <div class="mt-3 flex text-sm">
      <div class="ml-1 flex gap-6">
        <SearchFilterDropdown
          v-model:model-value="searchMode"
          :options="filterOptions"
          :label="$t('g.filter')"
        />
        <SearchFilterDropdown
          v-model:model-value="sortField"
          :options="availableSortOptions"
          :label="$t('g.sort')"
        />
      </div>
      <div class="ml-6 flex items-center gap-4">
        <small v-if="hasResults" class="text-color-secondary">
          {{ $t('g.resultsCount', { count: searchResults?.length || 0 }) }}
        </small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { stubTrue } from 'es-toolkit/compat'
import type { AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'
import AutoComplete from 'primevue/autocomplete'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { components } from '@/types/comfyRegistryTypes'
import type {
  QuerySuggestion,
  SearchMode,
  SortableField
} from '@/types/searchServiceTypes'
import PackInstallButton from '@/workbench/extensions/manager/components/manager/button/PackInstallButton.vue'
import PackUpdateButton from '@/workbench/extensions/manager/components/manager/button/PackUpdateButton.vue'
import SearchFilterDropdown from '@/workbench/extensions/manager/components/manager/registrySearchBar/SearchFilterDropdown.vue'
import { useMissingNodes } from '@/workbench/extensions/manager/composables/nodePack/useMissingNodes'
import { useUpdateAvailableNodes } from '@/workbench/extensions/manager/composables/nodePack/useUpdateAvailableNodes'
import { SortableAlgoliaField } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import type { SearchOption } from '@/workbench/extensions/manager/types/comfyManagerTypes'

const { searchResults, sortOptions } = defineProps<{
  searchResults?: components['schemas']['Node'][]
  suggestions?: QuerySuggestion[]
  sortOptions?: SortableField[]
  isMissingTab?: boolean
  isUpdateAvailableTab?: boolean
}>()

const searchQuery = defineModel<string>('searchQuery')
const searchMode = defineModel<SearchMode>('searchMode', { default: 'packs' })
const sortField = defineModel<string>('sortField', {
  default: SortableAlgoliaField.Downloads
})

const { t } = useI18n()

// Get missing node packs from workflow with loading and error states
const { missingNodePacks, isLoading, error } = useMissingNodes()

// Use the composable to get update available nodes
const {
  hasUpdateAvailable,
  enabledUpdateAvailableNodePacks,
  hasDisabledUpdatePacks
} = useUpdateAvailableNodes()

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
