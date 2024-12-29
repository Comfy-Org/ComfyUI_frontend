<template>
  <div class="flex h-96" data-testid="template-workflows-content">
    <div class="relative">
      <ProgressSpinner
        v-if="!workflowTemplatesStore.isLoaded"
        class="absolute w-8 h-full inset-0"
      />
      <Listbox
        v-model="selectedTab"
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
      :numVisible="4"
      :numScroll="3"
      :key="selectedTab.moduleName"
    >
      <template #item="slotProps">
        <div @click="loadWorkflow(slotProps.data)">
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
import { useDialogStore } from '@/stores/dialogStore'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useI18n } from 'vue-i18n'
import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'
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

const loadWorkflow = async (id: string) => {
  workflowLoading.value = id
  let json
  if (selectedTab.value.moduleName === 'default') {
    // Default templates provided by frontend are served on this separate endpoint
    json = await fetch(api.fileURL(`templates/${id}.json`)).then((r) =>
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
  await app.loadGraphData(
    json,
    true,
    true,
    t(`templateWorkflows.template.${id}`, id)
  )

  return false
}
</script>

<style lang="css" scoped>
.carousel {
  width: 1300px;
}
</style>
