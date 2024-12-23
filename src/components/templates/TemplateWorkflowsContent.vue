<template>
  <div class="flex">
    <Listbox v-model="selectedTab" :options="tabs" optionLabel="title" />
    <Carousel
      class="carousel"
      :value="selectedTab.templates"
      :numVisible="4"
      :numScroll="3"
      :key="selectedTab.moduleName"
    >
      <template #item="slotProps">
        <Card>
          <template #header>
            <div class="flex center justify-center">
              <div
                class="relative overflow-hidden rounded-lg cursor-pointer w-64 h-64"
                @click="loadWorkflow(slotProps.data)"
              >
                <img
                  v-if="selectedTab.moduleName === 'default'"
                  :src="`templates/${slotProps.data}.jpg`"
                  class="w-64 h-64 rounded-lg object-cover thumbnail"
                />
                <img
                  v-else
                  :src="`workflow_templates/${selectedTab.moduleName}/${slotProps.data}.jpg`"
                  class="w-64 h-64 rounded-lg object-cover thumbnail"
                />
                <a>
                  <div
                    class="absolute top-0 left-0 w-64 h-64 overflow-hidden opacity-0 transition duration-300 ease-in-out hover:opacity-100 bg-opacity-50 bg-black flex items-center justify-center"
                  >
                    <i class="pi pi-play-circle" style="color: white"></i>
                  </div>
                </a>
                <ProgressSpinner
                  v-if="loading === slotProps.data"
                  class="absolute inset-0 z-1 w-3/12 h-full"
                />
              </div>
            </div>
          </template>
          <template #subtitle>{{ slotProps.data }}</template>
        </Card>
      </template>
    </Carousel>
  </div>
</template>

<script setup lang="ts">
import { useDialogStore } from '@/stores/dialogStore'
import Carousel from 'primevue/carousel'
import Listbox from 'primevue/listbox'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { onMounted, ref } from 'vue'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useI18n } from 'vue-i18n'
import toast from 'primevue/toast'
const { t } = useI18n()

const loading = ref<string | null>(null)

interface WorkflowTemplatesTab {
  moduleName: string
  title: string
  templates: string[]
}

//These default templates are provided by the frontend
const comfyUITemplates = {
  moduleName: 'default',
  title: 'ComfyUI',
  templates: ['default', 'image2image', 'upscale', 'flux_schnell']
}

const tabs = ref<WorkflowTemplatesTab[]>([comfyUITemplates])

const selectedTab = ref<WorkflowTemplatesTab>(comfyUITemplates)

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
      api.fileURL(
        `workflow_templates/${selectedTab.value.moduleName}/${id}.json`
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
.p-card {
  --p-card-body-padding: 10px 0 0 0;
  overflow: hidden;
}

:deep(.p-card-subtitle) {
  text-align: center;
}

.carousel {
  width: 1300px;
}

/* Fallback graphics for workflows that don't have an image. */
img.thumbnail::before {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: var(--comfy-menu-secondary-bg);
  color: var(--fg-color);
  content: '🗎';
  text-align: center;
  align-content: center;
  font-size: 64px;
}
</style>
