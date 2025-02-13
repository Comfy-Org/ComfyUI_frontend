<template>
  <Card :data-testid="`template-workflow-${template.name}`" class="w-64">
    <template #header>
      <div class="flex items-center justify-center">
        <div class="relative overflow-hidden rounded-t-lg cursor-pointer">
          <img
            v-if="!imageError"
            :src="thumbnailSrc"
            :alt="title"
            class="w-64 h-64 rounded-t-lg object-cover thumbnail"
            @error="imageError = true"
          />
          <div v-else class="w-64 h-64 content-center text-center">
            <i class="pi pi-file" style="font-size: 4rem"></i>
          </div>
          <a>
            <div
              class="absolute top-0 left-0 w-64 h-64 overflow-hidden opacity-0 transition duration-300 ease-in-out hover:opacity-100 bg-opacity-50 bg-black flex items-center justify-center"
            >
              <i class="pi pi-play-circle" style="color: white"></i>
            </div>
          </a>
          <ProgressSpinner
            v-if="loading"
            class="absolute inset-0 z-1 w-3/12 h-full"
          />
        </div>
      </div>
    </template>
    <template #subtitle>
      <div class="text-center">
        {{ title }}
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { TemplateInfo } from '@/types/workflowTemplateTypes'

const { sourceModule, categoryTitle, loading, template } = defineProps<{
  sourceModule: string
  categoryTitle: string
  loading: boolean
  template: TemplateInfo
}>()

const { t } = useI18n()

const imageError = ref(false)

const thumbnailSrc = computed(() =>
  sourceModule === 'default'
    ? `/templates/${template.name}_1.${template.mediaSubtype}`
    : `/api/workflow_templates/${sourceModule}/${template.name}.${template.mediaSubtype}`
)
const title = computed(() => {
  return sourceModule !== 'default'
    ? template.name
    : t(
        `templateWorkflows.template.${categoryTitle}.${template.name}`,
        template.name
      )
})
</script>

<style lang="css" scoped>
.p-card {
  --p-card-body-padding: 10px 0 0 0;
  overflow: hidden;
}
</style>
