<template>
  <ScrollPanel class="w-60" style="height: calc(83vh - 48px)">
    <!-- View Selection Header -->
    <div
      class="text-left py-3 border-b border-surface-200 dark-theme:border-surface-700"
    >
      <Listbox
        :model-value="selectedView"
        :options="viewOptions"
        option-label="label"
        option-value="value"
        :multiple="false"
        class="w-full border-0 bg-transparent shadow-none"
        :pt="{
          list: { class: 'p-0' },
          header: { class: 'px-0' },
          option: {
            class: 'px-0 py-2 text-sm font-medium flex items-center gap-1'
          }
        }"
        @update:model-value="handleViewSelection"
      >
        <template #option="slotProps">
          <div class="flex self-center items-center gap-1 py-1 px-4">
            <i :class="slotProps.option.icon"></i>
            <div>{{ slotProps.option.label }}</div>
          </div>
        </template>
      </Listbox>
    </div>

    <!-- Template Groups and Subcategories -->
    <div class="w-full">
      <div v-for="group in props.tabs" :key="group.label" class="mb-2">
        <!-- Group Header -->
        <div class="text-left py-1">
          <h3
            class="text-muted text-xs font-bold uppercase tracking-wide text-surface-600 dark-theme:text-surface-400 px-4"
          >
            {{ group.label }}
          </h3>
        </div>

        <!-- Subcategories as Listbox -->
        <Listbox
          :model-value="selectedSubcategory"
          :options="group.subcategories"
          option-label="label"
          class="w-full border-0 bg-transparent shadow-none"
          :pt="{
            list: { class: 'p-0' },
            option: { class: 'px-4 py-3 text-sm' }
          }"
          @update:model-value="handleSubcategorySelection"
        >
          <template #option="slotProps">
            <div class="flex items-center">
              <div>{{ slotProps.option.label }}</div>
            </div>
          </template>
        </Listbox>
      </div>
    </div>
  </ScrollPanel>
</template>

<script setup lang="ts">
import Listbox from 'primevue/listbox'
import ScrollPanel from 'primevue/scrollpanel'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  TemplateGroup,
  TemplateSubcategory
} from '@/types/workflowTemplateTypes'

const { t } = useI18n()

const props = defineProps<{
  tabs: TemplateGroup[]
  selectedSubcategory: TemplateSubcategory | null
  selectedView: 'all' | 'recent' | null
}>()

const emit = defineEmits<{
  (e: 'update:selectedSubcategory', subcategory: TemplateSubcategory): void
  (e: 'update:selectedView', view: 'all' | 'recent'): void
}>()

const viewOptions = computed(() => {
  // Create a comprehensive "All Templates" subcategory that aggregates all modules
  const allTemplatesSubcategory = {
    label: t('templateWorkflows.view.allTemplates', 'All Templates'),
    modules: props.tabs.flatMap((group: TemplateGroup) =>
      group.subcategories.flatMap(
        (subcategory: TemplateSubcategory) => subcategory.modules
      )
    )
  }

  const recentItemsSubcategory = {
    label: t('templateWorkflows.view.recentItems', 'Recent Items'),
    modules: [] // Could be populated with recent templates if needed
  }

  return [
    {
      ...allTemplatesSubcategory,
      icon: 'pi pi-list mr-2'
    },
    {
      ...recentItemsSubcategory,
      icon: 'pi pi-clock mr-2'
    }
  ]
})

const handleSubcategorySelection = (subcategory: TemplateSubcategory) => {
  emit('update:selectedSubcategory', subcategory)
}

const handleViewSelection = (subcategory: TemplateSubcategory | null) => {
  // Prevent deselection - always keep a view selected
  if (subcategory !== null) {
    // Emit as subcategory selection since these now have comprehensive module data
    emit('update:selectedSubcategory', subcategory)

    // Also emit view selection for backward compatibility
    const viewValue = subcategory.label.includes('All Templates')
      ? 'all'
      : 'recent'
    emit('update:selectedView', viewValue)
  }
  // If subcategory is null, we don't emit anything, keeping the current selection
}
</script>
<style scoped>
:deep(.p-listbox-header) {
  padding: 0;
}
</style>
