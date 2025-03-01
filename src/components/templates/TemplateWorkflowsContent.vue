<template>
  <div
    class="flex flex-col h-[83vh] w-[89vw] mx-auto overflow-hidden"
    data-testid="template-workflows-content"
  >
    <Divider
      class="m-0 [&::before]:border-surface-border/70 [&::before]:border-t-2"
    />
    <div class="flex flex-1">
      <div class="relative">
        <ProgressSpinner
          v-if="!workflowTemplatesStore.isLoaded"
          class="absolute w-8 h-full inset-0"
        />
        <ScrollPanel style="width: 20rem; height: calc(85vh - 48px)">
          <Listbox
            :model-value="selectedTab"
            @update:model-value="handleTabSelection"
            :options="tabs"
            option-group-label="label"
            option-label="title"
            option-group-children="modules"
            :pt="{
              root: { class: 'w-full border-0 bg-transparent' },
              list: { class: 'p-0' },
              option: { class: 'px-12 py-3 text-lg' },
              optionGroup: { class: 'p-0 text-left text-inherit' }
            }"
            listStyle="max-height:unset"
          >
            <template #optiongroup="slotProps">
              <div class="text-left py-3 px-12">
                <h2 class="text-lg">{{ slotProps.option.label }}</h2>
              </div>
            </template>
          </Listbox>
        </ScrollPanel>
      </div>
      <div class="relative mx-[-1px]">
        <Divider
          layout="vertical"
          class="h-full p-0 m-0 [&::before]:border-l-2 [&::before]:border-surface-border/70"
        />
      </div>
      <ScrollPanel>
        <div v-if="selectedTab" class="flex flex-col px-12">
          <div class="py-3 text-left">
            <h2 class="text-lg">{{ selectedTab.title }}</h2>
          </div>
          <div class="flex flex-wrap gap-8">
            <div
              v-for="template in selectedTab.templates"
              :key="template.name"
              class="flex-none"
            >
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
      </ScrollPanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import Listbox from 'primevue/listbox'
import ProgressSpinner from 'primevue/progressspinner'
import ScrollPanel from 'primevue/scrollpanel'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'
import { useWorkflowTemplatesStore } from '@/stores/workflowTemplatesStore'
import type { WorkflowTemplates } from '@/types/workflowTemplateTypes'

const { t } = useI18n()

const workflowTemplatesStore = useWorkflowTemplatesStore()
const selectedTab = ref<WorkflowTemplates | null>(
  workflowTemplatesStore?.defaultTemplate
)
const workflowLoading = ref<string | null>(null)

const tabs = computed(() => workflowTemplatesStore.groupedTemplates)

onMounted(async () => {
  await workflowTemplatesStore.loadWorkflowTemplates()
})

const handleTabSelection = (selection: WorkflowTemplates | null) => {
  //Listbox allows deselecting so this special case is ignored here
  if (selection !== selectedTab.value && selection !== null)
    selectedTab.value = selection
}

const loadWorkflow = async (id: string) => {
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
