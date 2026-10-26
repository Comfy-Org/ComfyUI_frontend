<template>
  <AppMultiSelect
    v-model="selectedModels"
    v-model:search-query="modelSearchText"
    size="md"
    :class="triggerClass"
    :label="modelFilterLabel"
    :options="modelOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <AppMultiSelect
    v-model="selectedUseCases"
    size="md"
    :class="triggerClass"
    :label="useCaseFilterLabel"
    :options="useCaseOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <AppMultiSelect
    v-model="selectedRunsOn"
    size="md"
    :class="triggerClass"
    :label="runsOnFilterLabel"
    :options="runsOnOptions"
    :show-search-box="true"
    :show-selected-count="true"
    :show-clear-button="true"
    actions-placement="footer"
  />

  <AppSingleSelect
    v-model="sortSelection"
    size="md"
    :class="triggerClass"
    :label="$t('templateWorkflows.sorting')"
    :options="sortOptions"
  >
    <template #icon>
      <i
        class="icon-[lucide--arrow-up-down] size-[1.2em] text-muted-foreground"
      />
    </template>
  </AppSingleSelect>
</template>

<script setup lang="ts">
import AppMultiSelect from '@/components/common/AppMultiSelect.vue'
import type { SelectOption } from '@comfyorg/design-system/lib/select/types'
import AppSingleSelect from '@/components/common/AppSingleSelect.vue'
import type { TemplateSortMode } from '@/platform/workflow/templates/composables/useTemplateFiltering'

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
