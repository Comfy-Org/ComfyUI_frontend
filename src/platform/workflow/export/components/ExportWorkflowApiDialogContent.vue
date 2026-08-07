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

const { onClose } = defineProps<{
  onClose: () => void
}>()

const { t } = useI18n()
const { buildDocsUrl } = useExternalLink()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const { toastErrorHandler } = useErrorHandling()
const isDownloading = ref(false)

const quickstartUrl = buildDocsUrl('/', { includeLocale: true })
const initialWorkflowBaseName =
  workflowStore.activeWorkflow?.filename ?? 'workflow_api'
const workflowBaseName = ref(initialWorkflowBaseName)
const exportFilename = computed(() => {
  const baseName = stripJsonExtension(workflowBaseName.value.trim())
  return appendJsonExt(baseName || initialWorkflowBaseName)
})

function stripJsonExtension(filename: string) {
  return filename.replace(/\.json$/i, '')
}

function normalizeWorkflowBaseName() {
  const name = stripJsonExtension(workflowBaseName.value.trim()).trim()
  workflowBaseName.value = name || initialWorkflowBaseName
}

async function downloadWorkflow() {
  normalizeWorkflowBaseName()
  isDownloading.value = true
  try {
    await workflowService.exportWorkflow(exportFilename.value, 'output', {
      useWorkflowFilename: false,
      promptFilename: false
    })
    onClose()
  } catch (error) {
    toastErrorHandler(error)
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 pb-4">
    <p class="m-0 max-w-prose text-sm text-pretty text-muted-foreground">
      {{ t('apiExport.description') }}
    </p>

    <section class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <label
          for="api-export-filename"
          class="text-sm font-semibold text-base-foreground"
        >
          {{ t('apiExport.workflowFile') }}
        </label>
        <p
          id="api-export-format-description"
          class="m-0 text-sm text-muted-foreground"
        >
          {{ t('apiExport.apiFormat') }}
        </p>
      </div>
      <div class="relative">
        <Input
          id="api-export-filename"
          v-model="workflowBaseName"
          class="pr-16"
          aria-describedby="api-export-format-description api-export-extension"
          autocomplete="off"
          spellcheck="false"
          type="text"
          @blur="normalizeWorkflowBaseName"
        />
        <span
          id="api-export-extension"
          class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground"
        >
          {{ t('apiExport.fileExtension') }}
        </span>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3 class="m-0 text-sm font-semibold text-base-foreground">
          {{ t('apiExport.runWithPython') }}
        </h3>
        <p class="m-0 text-sm text-pretty text-muted-foreground">
          {{ t('apiExport.pythonDescription') }}
        </p>
      </div>
      <PythonSdkCodeBlock :filename="exportFilename" />
    </section>

    <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <Button
        as="a"
        class="w-full text-base-foreground no-underline visited:text-base-foreground sm:w-auto"
        :href="quickstartUrl"
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
