<script setup lang="ts">
import type { WorkflowParts } from '@/lib/workshop/workflow-parts'
import type { TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import WorkflowFileRow from '@/components/workshop/workflow-preview/WorkflowFileRow.vue'
import { GROUP_HEADING } from '@/components/workshop/workflow-preview/workflowFactsClasses'

const { t } = translationsFor('en')

defineProps<{ files: WorkflowParts['files'] }>()

const FILE_TYPE: Partial<Record<string, TranslationKey>> = {
  checkpoints: 'workshop.workflow.fileType.checkpoint',
  diffusion_models: 'workshop.workflow.fileType.diffusionModel',
  loras: 'workshop.workflow.fileType.lora',
  vae: 'workshop.workflow.fileType.vae',
  text_encoders: 'workshop.workflow.fileType.textEncoder',
  clip_vision: 'workshop.workflow.fileType.clipVision',
  controlnet: 'workshop.workflow.fileType.controlnet',
  upscale_models: 'workshop.workflow.fileType.upscaler',
  latent_upscale_models: 'workshop.workflow.fileType.upscaler',
  audio_encoders: 'workshop.workflow.fileType.audioEncoder',
  background_removal: 'workshop.workflow.fileType.backgroundRemoval'
}

function fileType(directory: string | undefined) {
  const key = directory ? FILE_TYPE[directory] : undefined
  return key ? t(key) : undefined
}
</script>

<template>
  <section v-if="files.length" data-testid="workflow-files">
    <h3 :class="GROUP_HEADING">
      {{ t('workshop.workflow.filesNeeded') }} · {{ files.length }}
    </h3>
    <p class="mt-1 mb-2 text-xs text-primary-warm-gray">
      {{ t('workshop.workflow.filesNote') }}
    </p>
    <ul class="flex flex-col">
      <li v-for="file in files" :key="file.name">
        <WorkflowFileRow
          :name="file.name"
          :href="file.href"
          :type="fileType(file.directory)"
          :folder="file.folder"
          :download-url="file.downloadUrl"
        />
      </li>
    </ul>
  </section>
  <p
    v-else
    class="text-sm text-primary-warm-gray"
    data-testid="workflow-no-files"
  >
    {{ t('workshop.workflow.noFiles') }}
  </p>
</template>
