<template>
  <div class="flex h-96" data-testid="template-workflows-content">
    <div class="relative">
      <ProgressSpinner
        v-if="!workflowTemplatesStore.isLoaded"
        class="absolute w-8 h-full inset-0"
      />
      <Listbox
        :model-value="selectedTab"
        @update:model-value="handleTabSelection"
        :options="tabs"
        optionLabel="title"
        scroll-height="auto"
        class="overflow-y-auto w-64 h-full"
        listStyle="max-height:unset"
      />
    </div>
    <Carousel
      class="carousel justify-center"
      :value="selectedTab.templates"
      :responsive-options="responsiveOptions"
      :numVisible="4"
      :numScroll="3"
      :key="selectedTab.moduleName"
    >
      <template #item="slotProps">
        <div @click="loadWorkflow(slotProps.data)" class="p-2">
          <TemplateWorkflowCard
            :moduleName="selectedTab.moduleName"
            :workflowName="slotProps.data"
            :loading="slotProps.data === workflowLoading"
          />
        </div>
      </template>
    </Carousel>
  </div>
</template>

<script setup lang="ts">
import Carousel from 'primevue/carousel'
import Listbox from 'primevue/listbox'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'
import { useWorkflowTemplatesStore } from '@/stores/workflowTemplatesStore'

interface WorkflowTemplatesTab {
  moduleName: string
  title: string
  templates: string[]
}

const { t } = useI18n()

//These default templates are provided by the frontend
const comfyUITemplates: WorkflowTemplatesTab = {
  moduleName: 'default',
  title: 'ComfyUI',
  templates: ['default', 'image2image', 'upscale', 'flux_schnell']
}

const responsiveOptions = ref([
  {
    breakpoint: '1660px',
    numVisible: 3,
    numScroll: 2
  },
  {
    breakpoint: '1360px',
    numVisible: 2,
    numScroll: 1
  },
  {
    breakpoint: '960px',
    numVisible: 1,
    numScroll: 1
  }
])

const workflowTemplatesStore = useWorkflowTemplatesStore()
const selectedTab = ref<WorkflowTemplatesTab>(comfyUITemplates)
const workflowLoading = ref<string | null>(null)

const tabs = computed<WorkflowTemplatesTab[]>(() => {
  return [
    comfyUITemplates,
    ...Object.entries(workflowTemplatesStore.items).map(([key, value]) => ({
      moduleName: key,
      title: key,
      templates: value
    }))
  ]
})

onMounted(async () => {
  await workflowTemplatesStore.loadWorkflowTemplates()
})

const handleTabSelection = (selection: WorkflowTemplatesTab | null) => {
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

<style lang="css" scoped>
.carousel {
  width: 66vw;
}
</style>
