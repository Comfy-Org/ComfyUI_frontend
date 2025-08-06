<template>
  <div
    class="flex flex-col h-[83vh] w-[90vw] relative pb-6 px-8 mx-auto"
    data-testid="template-workflows-content"
  >
    <Button
      v-if="isSmallScreen"
      :icon="isSideNavOpen ? 'pi pi-chevron-left' : 'pi pi-chevron-right'"
      text
      class="absolute top-1/2 -translate-y-1/2 z-10"
      :class="isSideNavOpen ? 'left-[19rem]' : 'left-2'"
      @click="toggleSideNav"
    />
    <Divider
      class="my-0 w-[90vw] -mx-8 relative [&::before]:border-surface-border/70 [&::before]:border-t-2"
    />

    <div class="flex flex-1 relative overflow-hidden">
      <aside
        v-if="isSideNavOpen"
        class="absolute translate-x-0 top-0 left-0 h-full w-60 shadow-md z-5 transition-transform duration-300 ease-in-out"
      >
        <ProgressSpinner
          v-if="!isTemplatesLoaded || !isReady"
          class="absolute w-8 h-full inset-0"
        />
        <TemplateWorkflowsSideNav
          :tabs="allTemplateGroups"
          :selected-subcategory="selectedSubcategory"
          :selected-view="selectedView"
          @update:selected-subcategory="handleSubcategory"
          @update:selected-view="handleViewSelection"
        />
      </aside>
      <div
        class="flex-1 transition-all duration-300"
        :class="{
          'pl-60': isSideNavOpen || !isSmallScreen,
          'pl-8': !isSideNavOpen && isSmallScreen
        }"
      >
        <div
          v-if="
            isReady &&
            (selectedView === 'all' ||
              selectedView === 'recent' ||
              selectedSubcategory)
          "
          class="flex flex-col h-full"
        >
          <div class="px-8 sm:px-12 py-4 border-b border-surface-border/20">
            <TemplateSearchBar
              v-model:search-query="searchQuery"
              v-model:selected-models="selectedModels"
              v-model:sort-by="sortBy"
              :filtered-count="filteredCount"
              :available-models="availableModels"
              @clear-filters="resetFilters"
            />
          </div>

          <TemplateWorkflowView
            class="px-8 sm:px-12 flex-1"
            :title="
              selectedSubcategory
                ? selectedSubcategory.label
                : selectedView === 'all'
                  ? $t('templateWorkflows.view.allTemplates', 'All Templates')
                  : selectedTemplate?.title || ''
            "
            :source-module="selectedTemplate?.moduleName || 'all'"
            :templates="filteredTemplates"
            :available-subcategories="availableSubcategories"
            :selected-subcategory="filterSubcategory"
            :loading="loadingTemplateId"
            :category-title="
              selectedSubcategory
                ? selectedSubcategory.label
                : selectedView === 'all'
                  ? $t('templateWorkflows.view.allTemplates', 'All Templates')
                  : selectedTemplate?.title || ''
            "
            @load-workflow="handleLoadWorkflow"
            @update:selected-subcategory="filterSubcategory = $event"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref, watch } from 'vue'

import TemplateSearchBar from '@/components/templates/TemplateSearchBar.vue'
import TemplateWorkflowView from '@/components/templates/TemplateWorkflowView.vue'
import TemplateWorkflowsSideNav from '@/components/templates/TemplateWorkflowsSideNav.vue'
import { useResponsiveCollapse } from '@/composables/element/useResponsiveCollapse'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import { useTemplateWorkflows } from '@/composables/useTemplateWorkflows'
import type { TemplateSubcategory } from '@/types/workflowTemplateTypes'

const {
  isSmallScreen,
  isOpen: isSideNavOpen,
  toggle: toggleSideNav
} = useResponsiveCollapse()

const {
  selectedTemplate,
  loadingTemplateId,
  isTemplatesLoaded,
  allTemplateGroups,
  loadTemplates,
  loadWorkflowTemplate
} = useTemplateWorkflows()

const { isReady } = useAsyncState(loadTemplates, null)

// State for subcategory selection
const selectedSubcategory = ref<TemplateSubcategory | null>(null)

// State for view selection (all vs recent)
const selectedView = ref<'all' | 'recent'>('all')

// Template filtering for the top-level search
const templatesRef = computed(() => {
  // If a subcategory is selected, use all templates from that subcategory
  if (selectedSubcategory.value) {
    return selectedSubcategory.value.modules.flatMap(
      (module) => module.templates
    )
  }

  // If "All Templates" view is selected and no subcategory, show all templates across all groups
  if (selectedView.value === 'all') {
    return allTemplateGroups.value.flatMap((group) =>
      group.subcategories.flatMap((subcategory) =>
        subcategory.modules.flatMap((module) => module.templates)
      )
    )
  }

  // Otherwise, use the selected template's templates (for recent view or fallback)
  return selectedTemplate.value?.templates || []
})

const {
  searchQuery,
  selectedModels,
  selectedSubcategory: filterSubcategory,
  sortBy,
  availableSubcategories,
  availableModels,
  filteredTemplates,
  filteredCount,
  resetFilters
} = useTemplateFiltering(templatesRef)

watch(
  isReady,
  () => {
    if (isReady.value) {
      // Start with "All Templates" view by default instead of selecting first subcategory
      selectedView.value = 'all'
      selectedSubcategory.value = null
    }
  },
  { once: true }
)

const handleSubcategory = (subcategory: TemplateSubcategory) => {
  selectedSubcategory.value = subcategory

  // On small screens, close the sidebar when a subcategory is selected
  if (isSmallScreen.value) {
    isSideNavOpen.value = false
  }
}

const handleViewSelection = (view: 'all' | 'recent') => {
  selectedView.value = view
  // Clear subcategory selection when switching to header views
  selectedSubcategory.value = null
}

const handleLoadWorkflow = async (id: string) => {
  if (!isReady.value || !selectedTemplate.value) return false

  return loadWorkflowTemplate(id, selectedTemplate.value.moduleName)
}
</script>
