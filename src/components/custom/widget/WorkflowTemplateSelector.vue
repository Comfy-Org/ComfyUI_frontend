<template>
  <BaseWidgetLayout
    :content-title="$t('templateWorkflows.title', 'Workflow Templates')"
  >
    <template #leftPanel>
      <LeftSidePanel v-model="selectedNavItem" :nav-items="navItems">
        <template #header-icon>
          <i-lucide:workflow class="text-neutral" />
        </template>
        <template #header-title>
          <span class="text-neutral text-base">{{
            $t('templateWorkflows.categories', 'Categories')
          }}</span>
        </template>
      </LeftSidePanel>
    </template>

    <template #header>
      <SearchBox v-model="searchQuery" class="max-w-[384px]" />
    </template>

    <template #header-right-area>
      <div class="flex gap-2">
        <IconTextButton
          type="primary"
          :label="$t('templateWorkflows.resetFilters', 'Reset Filters')"
          @click="resetFilters"
        >
          <template #icon>
            <i-lucide:filter-x />
          </template>
        </IconTextButton>
      </div>
    </template>

    <template #contentFilter>
      <div class="relative px-6 pt-2 pb-4 flex gap-2 flex-wrap">
        <!-- Model Filter -->
        <MultiSelect
          v-model="selectedModelObjects"
          :label="modelFilterLabel"
          :options="modelOptions"
        >
          <template #icon>
            <i-lucide:cpu />
          </template>
        </MultiSelect>

        <!-- Sort Options -->
        <SingleSelect
          v-model="sortBy"
          :label="$t('templateWorkflows.sorting', 'Sort by')"
          :options="sortOptions"
          class="w-[160px]"
        >
          <template #icon>
            <i-lucide:arrow-up-down />
          </template>
        </SingleSelect>

        <!-- Filter Tags -->
        <div
          v-if="selectedModelObjects.length > 0"
          class="flex flex-wrap gap-1 items-center"
        >
          <span class="text-sm text-neutral-600 dark:text-neutral-400">{{
            $t('templateWorkflows.activeFilters', 'Filters:')
          }}</span>
          <button
            v-for="modelObj in selectedModelObjects"
            :key="modelObj.value"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            @click="removeModelFilter(modelObj.value)"
          >
            {{ modelObj.name }}
            <i-lucide:x class="w-3 h-3" />
          </button>
        </div>
      </div>
    </template>

    <template #content>
      <div v-if="isLoading" class="flex items-center justify-center h-64">
        <div class="text-neutral-500">
          {{ $t('templateWorkflows.loading', 'Loading templates...') }}
        </div>
      </div>

      <div
        v-else-if="filteredTemplates.length === 0 && !isLoading"
        class="flex flex-col items-center justify-center h-64 text-neutral-500"
      >
        <i-lucide:search class="w-12 h-12 mb-4 opacity-50" />
        <p class="text-lg mb-2">
          {{ $t('templateWorkflows.noResults', 'No templates found') }}
        </p>
        <p class="text-sm">
          {{
            $t(
              'templateWorkflows.noResultsHint',
              'Try adjusting your search or filters'
            )
          }}
        </p>
      </div>

      <TemplateWorkflowView
        v-else
        :title="selectedCategoryTitle"
        :source-module="'default'"
        :templates="filteredTemplates"
        :loading="loadingTemplate"
        :category-title="selectedCategoryTitle"
        @load-workflow="onLoadWorkflow"
      />

      <!-- Results Summary -->
      <div
        v-if="!isLoading"
        class="mt-6 px-6 text-sm text-neutral-600 dark:text-neutral-400"
      >
        {{
          $t('templateWorkflows.resultsCount', {
            count: filteredCount,
            total: totalCount
          })
        }}
      </div>
    </template>

    <template #rightPanel>
      <RightSidePanel>
        <!-- Template details could go here -->
      </RightSidePanel>
    </template>
  </BaseWidgetLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconTextButton from '@/components/button/IconTextButton.vue'
import MultiSelect from '@/components/input/MultiSelect.vue'
import SearchBox from '@/components/input/SearchBox.vue'
import SingleSelect from '@/components/input/SingleSelect.vue'
import TemplateWorkflowView from '@/components/templates/TemplateWorkflowView.vue'
import BaseWidgetLayout from '@/components/widget/layout/BaseWidgetLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import RightSidePanel from '@/components/widget/panel/RightSidePanel.vue'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import { useTemplateWorkflows } from '@/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/stores/workflowTemplatesStore'
import type { NavGroupData, NavItemData } from '@/types/navTypes'
import { OnCloseKey } from '@/types/widgetTypes'

const { t } = useI18n()

const { onClose } = defineProps<{
  onClose: () => void
}>()

provide(OnCloseKey, onClose)

// Workflow templates store and composable
const workflowTemplatesStore = useWorkflowTemplatesStore()
const { loadTemplates, loadWorkflowTemplate } = useTemplateWorkflows()

// Get navigation items from the new store structure
const navItems = computed<(NavItemData | NavGroupData)[]>(() => {
  return workflowTemplatesStore.navGroupedTemplates
})

// Get enhanced templates for better filtering
const allTemplates = computed(() => {
  return workflowTemplatesStore.enhancedTemplates
})

// Filter templates based on selected navigation item using the store's filter function
const navigationFilteredTemplates = computed(() => {
  if (!selectedNavItem.value) {
    return allTemplates.value
  }

  return workflowTemplatesStore.filterTemplatesByCategory(selectedNavItem.value)
})

// Template filtering
const {
  searchQuery,
  selectedModels,
  sortBy,
  filteredTemplates,
  availableModels,
  filteredCount,
  totalCount,
  resetFilters,
  removeModelFilter
} = useTemplateFiltering(navigationFilteredTemplates)

// Convert between string array and object array for MultiSelect component
const selectedModelObjects = computed({
  get() {
    return selectedModels.value.map((model) => ({ name: model, value: model }))
  },
  set(value: { name: string; value: string }[]) {
    selectedModels.value = value.map((item) => item.value)
  }
})

// Loading state
const isLoading = ref(true)

// Navigation
const selectedNavItem = ref<string | null>('all')

// Model filter options
const modelOptions = computed(() =>
  availableModels.value.map((model) => ({
    name: model,
    value: model
  }))
)

// Model filter label
const modelFilterLabel = computed(() => {
  if (selectedModelObjects.value.length === 0) {
    return t('templateWorkflows.modelFilter', 'Model Filter')
  } else if (selectedModelObjects.value.length === 1) {
    return selectedModelObjects.value[0].name
  } else {
    return t('templateWorkflows.modelsSelected', {
      count: selectedModelObjects.value.length
    })
  }
})

// Sort options
const sortOptions = computed(() => [
  {
    name: t('templateWorkflows.sort.recommended', 'Recommended'),
    value: 'recommended'
  },
  {
    name: t('templateWorkflows.sort.alphabetical', 'A → Z'),
    value: 'alphabetical'
  },
  { name: t('templateWorkflows.sort.newest', 'Newest'), value: 'newest' }
])

// Additional computed properties for TemplateWorkflowView
const selectedCategoryTitle = computed(() => {
  if (!selectedNavItem.value)
    return t('templateWorkflows.title', 'Workflow Templates')

  const navItem = navItems.value.find((item) => {
    if ('id' in item) {
      return item.id === selectedNavItem.value
    }
    return false
  })

  if (navItem && 'title' in navItem) {
    return navItem.title
  }

  return t('templateWorkflows.title', 'Workflow Templates')
})

const loadingTemplate = ref<string | null>(null)

// Methods
const onLoadWorkflow = async (templateName: string) => {
  loadingTemplate.value = templateName
  try {
    await loadWorkflowTemplate(templateName, 'default')
  } finally {
    loadingTemplate.value = null
  }
}

// Initialize
onMounted(async () => {
  await loadTemplates()
  await workflowTemplatesStore.loadWorkflowTemplates()
  isLoading.value = false
})
</script>
