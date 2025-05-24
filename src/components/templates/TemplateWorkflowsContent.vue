<template>
  <div
    class="flex flex-col h-[83vh] w-[90vw] relative pb-6"
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
      class="m-0 [&::before]:border-surface-border/70 [&::before]:border-t-2"
    />
    <div class="flex flex-1 relative overflow-hidden">
      <aside
        v-if="isSideNavOpen"
        class="absolute translate-x-0 top-0 left-0 h-full w-80 shadow-md z-5 transition-transform duration-300 ease-in-out"
      >
        <ProgressSpinner
          v-if="!isTemplatesLoaded || !isReady"
          class="absolute w-8 h-full inset-0"
        />
        <TemplateWorkflowsSideNav
          :tabs="allTemplateGroups"
          :selected-tab="selectedTemplate"
          @update:selected-tab="handleTabSelection"
        />
      </aside>
      <div
        class="flex-1 transition-all duration-300"
        :class="{
          'pl-80': isSideNavOpen || !isSmallScreen,
          'pl-8': !isSideNavOpen && isSmallScreen
        }"
      >
        <TemplateWorkflowView
          v-if="isReady && selectedTemplate"
          class="px-12 py-4"
          :title="selectedTemplate.title"
          :source-module="selectedTemplate.moduleName"
          :templates="selectedTemplate.templates"
          :loading="loadingTemplateId"
          :category-title="selectedTemplate.title"
          @load-workflow="handleLoadWorkflow"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'
import { watch } from 'vue'

import TemplateWorkflowView from '@/components/templates/TemplateWorkflowView.vue'
import TemplateWorkflowsSideNav from '@/components/templates/TemplateWorkflowsSideNav.vue'
import { useResponsiveCollapse } from '@/composables/element/useResponsiveCollapse'
import { useTemplateWorkflows } from '@/composables/useTemplateWorkflows'
import type { WorkflowTemplates } from '@/types/workflowTemplateTypes'

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
  selectFirstTemplateCategory,
  selectTemplateCategory,
  loadWorkflowTemplate
} = useTemplateWorkflows()

const { isReady } = useAsyncState(loadTemplates, null)

watch(
  isReady,
  () => {
    if (isReady.value) {
      selectFirstTemplateCategory()
    }
  },
  { once: true }
)

const handleTabSelection = (selection: WorkflowTemplates | null) => {
  if (selection !== null) {
    selectTemplateCategory(selection)

    // On small screens, close the sidebar when a category is selected
    if (isSmallScreen.value) {
      isSideNavOpen.value = false
    }
  }
}

const handleLoadWorkflow = async (id: string) => {
  if (!isReady.value || !selectedTemplate.value) return false

  return loadWorkflowTemplate(id, selectedTemplate.value.moduleName)
}
</script>
