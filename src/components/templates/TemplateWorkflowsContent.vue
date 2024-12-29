<template>
  <div class="flex h-96" data-testid="template-workflows-content">
    <Listbox
      v-model="selectedTab"
      :options="tabs"
      optionLabel="title"
      scroll-height="auto"
      class="listbox"
      listStyle="max-height:unset"
    />
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
            :loading="slotProps.data === loading"
          />
        </div>
      </template>
    </Carousel>
  </div>
</template>

<script setup lang="ts">
import Carousel from 'primevue/carousel'
import Listbox from 'primevue/listbox'
import { useToast } from 'primevue/usetoast'
import { onMounted, ref } from 'vue'
import { useDialogStore } from '@/stores/dialogStore'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useI18n } from 'vue-i18n'
import TemplateWorkflowCard from '@/components/templates/TemplateWorkflowCard.vue'

interface WorkflowTemplatesTab {
  moduleName: string
  title: string
  templates: string[]
}

const { t } = useI18n()
const toast = useToast()

//These default templates are provided by the frontend
const comfyUITemplates: WorkflowTemplatesTab = {
  moduleName: 'default',
  title: 'ComfyUI',
  templates: ['default', 'image2image', 'upscale', 'flux_schnell']
}

const tabs = ref<WorkflowTemplatesTab[]>([comfyUITemplates])
const selectedTab = ref<WorkflowTemplatesTab>(comfyUITemplates)
const loading = ref<string | null>(null)

onMounted(async () => {
  try {
    const workflowTemplates = await api.getWorkflowTemplates()
    tabs.value = [
      comfyUITemplates,
      ...Object.entries(workflowTemplates).map(([key, value]) => ({
        moduleName: key,
        title: key,
        templates: value
      }))
    ]
  } catch (error) {
    console.error('Error fetching workflow templates:', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to fetch workflow templates',
      life: 5000
    })
  }
})

const loadWorkflow = async (id: string) => {
  loading.value = id
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
.listbox {
  overflow-y: auto;
}

.carousel {
  width: 1300px;
}
</style>
