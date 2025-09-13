<template>
  <ScrollPanel class="w-80" style="height: calc(83vh - 48px)">
    <Listbox
      :model-value="selectedTab"
      :options="tabs"
      option-group-label="label"
      option-label="localizedTitle"
      option-group-children="modules"
      class="w-full border-0 bg-transparent shadow-none"
      :pt="{
        list: { class: 'p-0' },
        option: { class: 'px-12 py-3 text-lg' },
        optionGroup: { class: 'p-0 text-left text-inherit' }
      }"
      list-style="max-height:unset"
      @update:model-value="handleTabSelection"
    >
      <template #optiongroup="slotProps">
        <div class="text-left py-3 px-12">
          <h2 class="text-lg">
            {{ slotProps.option.label }}
          </h2>
        </div>
      </template>
    </Listbox>
  </ScrollPanel>
</template>

<script setup lang="ts">
import Listbox from 'primevue/listbox'
import ScrollPanel from 'primevue/scrollpanel'

import type {
  TemplateGroup,
  WorkflowTemplates
} from '@/types/workflowTemplateTypes'

defineProps<{
  tabs: TemplateGroup[]
  selectedTab: WorkflowTemplates | null
}>()

const emit = defineEmits<{
  (e: 'update:selectedTab', tab: WorkflowTemplates): void
}>()

const handleTabSelection = (tab: WorkflowTemplates) => {
  emit('update:selectedTab', tab)
}
</script>
