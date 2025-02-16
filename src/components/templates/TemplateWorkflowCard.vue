<template>
  <Card :data-testid="`template-workflow-${template.name}`" class="w-64">
    <template #header>
      <div class="flex items-center justify-center">
        <div class="relative overflow-hidden rounded-t-lg cursor-pointer">
          <template v-if="template.mediaType === 'audio'">
            <div class="w-64 h-64 flex items-center justify-center p-4 z-20">
              <audio
                controls
                class="w-full relative z-20"
                :src="thumbnailSrc"
                @error="imageError = true"
                @click.stop
              />
            </div>
          </template>
          <template v-else>
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
          </template>
          <a @click="$emit('loadWorkflow', template.name)">
            <div
              class="absolute top-0 left-0 w-64 h-64 overflow-hidden opacity-0 transition duration-300 ease-in-out hover:opacity-100 bg-opacity-50 bg-black flex items-center justify-center z-10"
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
import { normalizeI18nKey } from '@/utils/formatUtil'

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
    ? `/templates/${template.name}.${template.mediaSubtype}`
    : `/api/workflow_templates/${sourceModule}/${template.name}.${template.mediaSubtype}`
)
const title = computed(() => {
  return sourceModule === 'default'
    ? t(
        `templateWorkflows.template.${normalizeI18nKey(categoryTitle)}.${normalizeI18nKey(template.name)}`
      )
    : template.name ?? `${sourceModule} Template`
})

defineEmits<{
  loadWorkflow: [name: string]
}>()
</script>

<style lang="css" scoped>
.p-card {
  --p-card-body-padding: 10px 0 0 0;
  overflow: hidden;
}
</style>
