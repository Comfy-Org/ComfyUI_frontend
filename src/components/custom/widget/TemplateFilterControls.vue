<template>
  <MultiSelect
    v-model="selectedModels"
    v-model:search-query="modelSearchText"
    :search-label="$t('g.search')"
    :search-placeholder="$t('g.search')"
    :empty-text="$t('g.noResultsFound')"
    :accessible-label="modelFilterLabel || $t('g.multiSelectDropdown')"
    :clear-all-label="$t('g.clearAll')"
    :format-selected-count="(count) => $t('g.itemsSelected', { count })"
    size="md"
    :class="triggerClass"
    :label="modelFilterLabel"
    :options="modelOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <MultiSelect
    v-model="selectedUseCases"
    :search-label="$t('g.search')"
    :search-placeholder="$t('g.search')"
    :empty-text="$t('g.noResultsFound')"
    :accessible-label="useCaseFilterLabel || $t('g.multiSelectDropdown')"
    :clear-all-label="$t('g.clearAll')"
    :format-selected-count="(count) => $t('g.itemsSelected', { count })"
    size="md"
    :class="triggerClass"
    :label="useCaseFilterLabel"
    :options="useCaseOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <MultiSelect
    v-model="selectedRunsOn"
    :search-label="$t('g.search')"
    :search-placeholder="$t('g.search')"
    :empty-text="$t('g.noResultsFound')"
    :accessible-label="runsOnFilterLabel || $t('g.multiSelectDropdown')"
    :clear-all-label="$t('g.clearAll')"
    :format-selected-count="(count) => $t('g.itemsSelected', { count })"
    size="md"
    :class="triggerClass"
    :label="runsOnFilterLabel"
    :options="runsOnOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <SingleSelect
    v-model="sortSelection"
    :search-label="$t('g.search')"
    :search-placeholder="$t('g.search')"
    :empty-text="$t('g.noResultsFound')"
    :accessible-label="
      $t('templateWorkflows.sorting') || $t('g.singleSelectDropdown')
    "
    size="md"
    :class="triggerClass"
    :label="$t('templateWorkflows.sorting')"
    :options="sortOptions"
  >
    <template #icon>
      <i class="icon-[lucide--arrow-up-down] text-muted-foreground" />
    </template>
  </SingleSelect>
</template>

<script setup lang="ts">
import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'
import type { SelectOption } from '@/components/ui/select/types'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import type { TemplateSortMode } from '@/composables/useTemplateFiltering'

const {
  modelOptions,
  useCaseOptions,
  runsOnOptions,
  sortOptions,
  modelFilterLabel,
  useCaseFilterLabel,
  runsOnFilterLabel,
  triggerClass = ''
} = defineProps<{
  modelOptions: SelectOption[]
  useCaseOptions: SelectOption[]
  runsOnOptions: SelectOption[]
  sortOptions: SelectOption[]
  modelFilterLabel: string
  useCaseFilterLabel: string
  runsOnFilterLabel: string
  triggerClass?: string
}>()

const selectedModels = defineModel<SelectOption[]>('selectedModels', {
  required: true
})
const selectedUseCases = defineModel<SelectOption[]>('selectedUseCases', {
  required: true
})
const selectedRunsOn = defineModel<SelectOption[]>('selectedRunsOn', {
  required: true
})
const sortSelection = defineModel<TemplateSortMode>('sortSelection', {
  required: true
})
const modelSearchText = defineModel<string>('modelSearchText', {
  required: true
})
</script>
