<template>
  <BaseWidgetLayout
    :content-title="$t('templateWorkflows.title', 'Workflow Templates')"
    class="workflow-template-selector-root"
  >
    <template #leftPanel>
      <LeftSidePanel v-model="selectedNavItem" :nav-items="navItems">
        <template #header-icon>
          <i class="icon-[comfy--template]" />
        </template>
        <template #header-title>
          <span class="text-neutral text-base">{{
            $t('sideToolbar.templates', 'Templates')
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
      <div class="relative px-6 pt-2 pb-4 flex gap-2 flex-wrap justify-between">
        <!-- Filters -->
        <div class="flex gap-2 flex-wrap">
          <!-- Model Filter -->
          <MultiSelect
            v-model="selectedModelObjects"
            :label="modelFilterLabel"
            :options="modelOptions"
            :has-search-box="true"
            :search-placeholder="
              $t('templateWorkflows.searchModels', 'Search models...')
            "
          >
            <template #icon>
              <i-lucide:cpu />
            </template>
          </MultiSelect>

          <!-- Use Case Filter -->
          <MultiSelect
            v-model="selectedUseCaseObjects"
            :label="useCaseFilterLabel"
            :options="useCaseOptions"
            :has-search-box="true"
            :search-placeholder="
              $t('templateWorkflows.searchUseCases', 'Search use cases...')
            "
          >
            <template #icon>
              <i-lucide:target />
            </template>
          </MultiSelect>

          <!-- License Filter -->
          <MultiSelect
            v-model="selectedLicenseObjects"
            :label="licenseFilterLabel"
            :options="licenseOptions"
            :has-search-box="true"
            :search-placeholder="
              $t('templateWorkflows.searchLicenses', 'Search licenses...')
            "
          >
            <template #icon>
              <i-lucide:file-text />
            </template>
          </MultiSelect>
        </div>

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
  selectedUseCases,
  selectedLicenses,
  sortBy,
  filteredTemplates,
  availableModels,
  availableUseCases,
  availableLicenses,
  filteredCount,
  totalCount,
  resetFilters
  // removeModelFilter,
  // removeUseCaseFilter,
  // removeLicenseFilter
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

const selectedUseCaseObjects = computed({
  get() {
    return selectedUseCases.value.map((useCase) => ({
      name: useCase,
      value: useCase
    }))
  },
  set(value: { name: string; value: string }[]) {
    selectedUseCases.value = value.map((item) => item.value)
  }
})

const selectedLicenseObjects = computed({
  get() {
    return selectedLicenses.value.map((license) => ({
      name: license,
      value: license
    }))
  },
  set(value: { name: string; value: string }[]) {
    selectedLicenses.value = value.map((item) => item.value)
  }
})

// Loading state
const isLoading = ref(true)

// Navigation
const selectedNavItem = ref<string | null>('all')

// Filter options
const modelOptions = computed(() =>
  availableModels.value.map((model) => ({
    name: model,
    value: model
  }))
)

const useCaseOptions = computed(() =>
  availableUseCases.value.map((useCase) => ({
    name: useCase,
    value: useCase
  }))
)

const licenseOptions = computed(() =>
  availableLicenses.value.map((license) => ({
    name: license,
    value: license
  }))
)

// Filter labels
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

const useCaseFilterLabel = computed(() => {
  if (selectedUseCaseObjects.value.length === 0) {
    return t('templateWorkflows.useCaseFilter', 'Use Case')
  } else if (selectedUseCaseObjects.value.length === 1) {
    return selectedUseCaseObjects.value[0].name
  } else {
    return t('templateWorkflows.useCasesSelected', {
      count: selectedUseCaseObjects.value.length
    })
  }
})

const licenseFilterLabel = computed(() => {
  if (selectedLicenseObjects.value.length === 0) {
    return t('templateWorkflows.licenseFilter', 'License')
  } else if (selectedLicenseObjects.value.length === 1) {
    return selectedLicenseObjects.value[0].name
  } else {
    return t('templateWorkflows.licensesSelected', {
      count: selectedLicenseObjects.value.length
    })
  }
})

// Sort options
const sortOptions = computed(() => [
  {
    name: t('templateWorkflows.sort.default', 'Default'),
    value: 'default'
  },
  { name: t('templateWorkflows.sort.newest', 'Newest'), value: 'newest' },
  {
    name: t(
      'templateWorkflows.sort.vramLowToHigh',
      'VRAM Utilization (Low to High)'
    ),
    value: 'vram-low-to-high'
  },
  {
    name: t(
      'templateWorkflows.sort.modelSizeLowToHigh',
      'Model Size (Low to High)'
    ),
    value: 'model-size-low-to-high'
  },
  {
    name: t('templateWorkflows.sort.alphabetical', 'Alphabetical (A-Z)'),
    value: 'alphabetical'
  }
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

<style>
/* Ensure the workflow template selector fits within provided dialog without horizontal overflow */
.workflow-template-selector-root.base-widget-layout {
  width: 100% !important;
  max-width: 1400px; /* matches dialog max-width */
  height: 100% !important;
  aspect-ratio: auto !important;
}
@media (min-width: 1600px) {
  .workflow-template-selector-root.base-widget-layout {
    max-width: 1600px;
  }
}
</style>
