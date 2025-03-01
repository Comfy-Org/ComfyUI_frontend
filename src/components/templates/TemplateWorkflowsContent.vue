<template>
  <div
    class="flex flex-col h-[83vh] w-[90vw] relative"
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
          v-if="!workflowTemplatesStore.isLoaded"
          class="absolute w-8 h-full inset-0"
        />
        <TemplateWorkflowsSideNav
          :tabs="tabs"
          :selected-tab="selectedTab"
          @update:selected-tab="handleTabSelection"
        />
      </aside>
      <div
        class="flex-1 overflow-auto transition-all duration-300"
        :class="{
          'pl-80': isSideNavOpen || !isSmallScreen,
          'pl-8': !isSideNavOpen && isSmallScreen
        }"
      >
        <div v-if="selectedTab" class="flex flex-col px-12 pb-4">
          <div class="py-3 text-left">
            <h2 class="text-lg">{{ selectedTab.title }}</h2>
          </div>
          <div
            class="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-8 justify-items-center"
          >
            <div v-for="template in selectedTab.templates" :key="template.name">
              <TemplateWorkflowCard
                :sourceModule="selectedTab.moduleName"
                :template="template"
                :loading="template.name === workflowLoading"
                :categoryTitle="selectedTab.title"
                @loadWorkflow="loadWorkflow"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import { useAsyncState } from '@vueuse/core'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import TemplateWorkflowsSideNav from '@/components/templates/TemplateWorkflowsSideNav.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'
import { useWorkflowTemplatesStore } from '@/stores/workflowTemplatesStore'
import type { WorkflowTemplates } from '@/types/workflowTemplateTypes'

const { t } = useI18n()

const breakpoints = useBreakpoints({
  mobile: 0,
  tablet: 768,
  desktop: 1024
})
const isSmallScreen = breakpoints.between('mobile', 'desktop')
const isSideNavOpen = ref(!isSmallScreen.value)
const toggleSideNav = () => {
  isSideNavOpen.value = !isSideNavOpen.value
}
watch(isSmallScreen, toggleSideNav)

const workflowTemplatesStore = useWorkflowTemplatesStore()
const { isReady } = useAsyncState(
  workflowTemplatesStore.loadWorkflowTemplates,
  null
)

const selectedTab = ref<WorkflowTemplates | null>(
  workflowTemplatesStore.defaultTemplate
)
const workflowLoading = ref<string | null>(null)

const tabs = computed(() => workflowTemplatesStore.groupedTemplates)

const handleTabSelection = (selection: WorkflowTemplates | null) => {
  //Listbox allows deselecting so this special case is ignored here
  if (selection !== selectedTab.value && selection !== null) {
    selectedTab.value = selection

    // On small screens, close the sidebar when a category is selected
    if (isSmallScreen.value) {
      isSideNavOpen.value = false
    }
  }
}

const loadWorkflow = async (id: string) => {
  if (!isReady.value) return

  workflowLoading.value = id
  let json
  if (selectedTab.value.moduleName === 'default') {
    // Default templates provided by frontend are served on this separate endpoint
    json = await fetch(api.fileURL(`/templates/${id}.json`)).then((r) =>
      r.json()
    )
  } else {
    json = await fetch(
      api.apiURL(
        `/workflow_templates/${selectedTab.value.moduleName}/${id}.json`
      )
    ).then((r) => r.json())
  }
  useDialogStore().closeDialog()
  const workflowName =
    selectedTab.value.moduleName === 'default'
      ? t(`templateWorkflows.template.${id}`, id)
      : id
  await app.loadGraphData(json, true, true, workflowName)

  return false
}
</script>
