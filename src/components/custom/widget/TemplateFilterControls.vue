<template>
  <MultiSelect
    v-model="selectedModels"
    v-model:search-query="modelSearchText"
    size="md"
    :class="triggerClass"
    :content-style="contentStyle"
    :label="modelFilterLabel"
    :options="modelOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <MultiSelect
    v-model="selectedUseCases"
    size="md"
    :class="triggerClass"
    :content-style="contentStyle"
    :label="useCaseFilterLabel"
    :options="useCaseOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <MultiSelect
    v-model="selectedRunsOn"
    size="md"
    :class="triggerClass"
    :content-style="contentStyle"
    :label="runsOnFilterLabel"
    :options="runsOnOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <SingleSelect
    v-if="showSort"
    v-model="sortSelection"
    size="md"
    :class="triggerClass"
    :content-style="contentStyle"
    :label="$t('templateWorkflows.sorting')"
    :options="sortOptions"
  >
    <template #icon>
      <i class="icon-[lucide--arrow-up-down] text-muted-foreground" />
    </template>
  </SingleSelect>
</template>

<script setup lang="ts">
import type { StyleValue } from 'vue'

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
  triggerClass = '',
  showSort = true,
  contentStyle
} = defineProps<{
  modelOptions: SelectOption[]
  useCaseOptions: SelectOption[]
  runsOnOptions: SelectOption[]
  sortOptions: SelectOption[]
  modelFilterLabel: string
  useCaseFilterLabel: string
  runsOnFilterLabel: string
  triggerClass?: string
  showSort?: boolean
  /** Style forwarded to the dropdown panels (e.g. to match trigger width) */
  contentStyle?: StyleValue
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
