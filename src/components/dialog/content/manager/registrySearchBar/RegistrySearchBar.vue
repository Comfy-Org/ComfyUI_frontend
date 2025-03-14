<template>
  <div class="relative w-full p-6">
    <div class="flex items-center w-full">
      <IconField class="w-5/12">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          :placeholder="$t('manager.searchPlaceholder')"
          class="w-full rounded-2xl"
          autofocus
        />
      </IconField>
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
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchFilterDropdown from '@/components/dialog/content/manager/registrySearchBar/SearchFilterDropdown.vue'
import type { PackField, SearchOption } from '@/types/comfyManagerTypes'
import { components } from '@/types/comfyRegistryTypes'

const props = defineProps<{
  searchResults?: components['schemas']['Node'][]
}>()

const searchQuery = defineModel<string>('searchQuery')
const searchMode = defineModel<string>('searchMode', { default: 'packs' })
const sortField = defineModel<PackField>('sortField', { default: 'downloads' })

const { t } = useI18n()

const hasResults = computed(
  () => searchQuery.value?.trim() && props.searchResults?.length
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
</script>
