<template>
  <Card :data-testid="`template-workflow-${workflowName}`">
    <template #header>
      <div class="flex items-center justify-center">
        <div
          class="relative overflow-hidden rounded-t-lg cursor-pointer w-64 h-64"
        >
          <img
            v-if="!imageError"
            :src="thumbnailSrc"
            :alt="subtitle"
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
      {{ subtitle }}
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const {
  moduleName,
  workflowName,
  categoryName,
  loading,
  type = 'image'
} = defineProps<{
  moduleName: string
  workflowName: string
  categoryName: string
  loading: boolean
  type?: string
}>()

const { t } = useI18n()

const thumbnailSrc = computed(() => {
  switch (moduleName) {
    case 'default':
      return `/templates/${workflowName}_1${thumbnailExt.value}`
    default:
      return `/api/workflow_templates/${moduleName}/${workflowName}${thumbnailExt.value}`
  }
})

const thumbnailExt = computed(() => {
  switch (type) {
    case 'video':
      return '.webp'
    case 'audio':
      return '.flac'
    case 'image':
    default:
      return '.png'
  }
})

const subtitle = computed(() => {
  switch (moduleName) {
    case 'default':
      // Default templates have translations
      return t(
        `templateWorkflows.template.${categoryName}.${workflowName}`,
        workflowName
      )
    default:
      return workflowName ?? `${moduleName} workflow`
  }
})

const imageError = ref(false)
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
