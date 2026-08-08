<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useExternalLink } from '@/composables/useExternalLink'
import PythonSdkCodeBlock from '@/platform/workflow/export/components/PythonSdkCodeBlock.vue'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { appendJsonExt } from '@/utils/formatUtil'

const { onClose } = defineProps<{ onClose: () => void }>()

const { t } = useI18n()
const { buildDocsUrl } = useExternalLink()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const { toastErrorHandler } = useErrorHandling()
const isDownloading = ref(false)

const initialWorkflowBaseName =
  workflowStore.activeWorkflow?.filename ?? 'workflow_api'
const workflowBaseName = ref(initialWorkflowBaseName)
const exportFilename = computed(() => {
  const baseName = stripJsonExtension(workflowBaseName.value.trim())
  return appendJsonExt(baseName || initialWorkflowBaseName)
})
const stripJsonExtension = (filename: string) =>
  filename.replace(/\.json$/i, '')

function normalizeWorkflowBaseName() {
  const name = stripJsonExtension(workflowBaseName.value.trim()).trim()
  workflowBaseName.value = name || initialWorkflowBaseName
}

function downloadWorkflow() {
  normalizeWorkflowBaseName()
  isDownloading.value = true
  void workflowService
    .exportWorkflow(exportFilename.value, 'output', {
      useWorkflowFilename: false,
      promptFilename: false
    })
    .then(onClose)
    .catch(toastErrorHandler)
    .finally(() => (isDownloading.value = false))
}
</script>

<template>
  <div class="flex flex-col gap-6 pb-4">
    <p class="m-0 max-w-prose text-sm text-pretty text-muted-foreground">
      {{ t('apiExport.description') }}
    </p>

    <div class="flex flex-col gap-1 text-sm">
      <label for="api-export-filename" class="font-semibold">
        {{ t('apiExport.workflowFile') }}
      </label>
      <span id="api-export-format-description" class="text-muted-foreground">
        {{ t('apiExport.apiFormat') }}
      </span>
      <div class="relative">
        <Input
          id="api-export-filename"
          v-model="workflowBaseName"
          class="pr-16"
          aria-describedby="api-export-format-description api-export-extension"
          @blur="normalizeWorkflowBaseName"
        />
        <span
          id="api-export-extension"
          class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
        >
          {{ t('apiExport.fileExtension') }}
        </span>
      </div>
    </div>

    <PythonSdkCodeBlock :filename="exportFilename" />

    <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <Button
        as="a"
        class="w-full text-base-foreground no-underline visited:text-base-foreground sm:w-auto"
        :href="buildDocsUrl('/', { includeLocale: true })"
        rel="noopener noreferrer"
        size="lg"
        target="_blank"
        variant="secondary"
      >
        {{ t('apiExport.openQuickstart') }}
        <i class="icon-[lucide--external-link] size-4" aria-hidden="true" />
      </Button>
      <Button
        class="w-full sm:w-auto"
        :loading="isDownloading"
        size="lg"
        variant="primary"
        @click="downloadWorkflow"
      >
        <i class="icon-[lucide--download] size-4" aria-hidden="true" />
        {{ t('apiExport.downloadWorkflow') }}
      </Button>
    </div>
  </div>
</template>
