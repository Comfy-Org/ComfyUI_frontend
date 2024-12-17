<template>
  <div
    class="flex flex-wrap content-around justify-around gap-4 mt-4"
    data-testid="template-workflows-content"
  >
    <div
      v-for="template in templates"
      :key="template"
      :data-testid="`template-workflow-${template}`"
    >
      <Card>
        <template #header>
          <div
            class="relative overflow-hidden rounded-lg cursor-pointer"
            @click="loadWorkflow(template)"
          >
            <img
              :src="`templates/${template}.jpg`"
              class="w-64 h-64 rounded-lg object-cover"
            />
            <a>
              <div
                class="absolute top-0 left-0 w-64 h-64 overflow-hidden opacity-0 transition duration-300 ease-in-out hover:opacity-100 bg-opacity-50 bg-black flex items-center justify-center"
              >
                <i class="pi pi-play-circle"></i>
              </div>
            </a>
            <ProgressSpinner
              v-if="loading === template"
              class="absolute inset-0 z-1 w-3/12 h-full"
            />
          </div>
        </template>
        <template #subtitle>{{
          $t(`templateWorkflows.template.${template}`)
        }}</template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDialogStore } from '@/stores/dialogStore'
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { ref } from 'vue'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const templates = ['default', 'image2image', 'upscale', 'flux_schnell']
const loading = ref<string | null>(null)

const loadWorkflow = async (id: string) => {
  loading.value = id
  const json = await fetch(api.fileURL(`templates/${id}.json`)).then((r) =>
    r.json()
  )
  useDialogStore().closeDialog()
  await app.loadGraphData(
    json,
    true,
    true,
    t(`templateWorkflows.template.${id}`)
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
</style>
