<template>
  <div class="load-workflow-error flex flex-col gap-4">
    <NoResultsPlaceholder
      class="pb-0"
      icon="pi pi-exclamation-circle"
      :title="t('loadWorkflowErrorDialog.title')"
      :message="error"
    />
    <pre
      class="stack-trace p-5 text-neutral-400 text-xs max-h-[50vh] overflow-auto bg-black/20"
    >
      {{ stackTrace }}
    </pre>

    <template v-if="extensionFile">
      <span>{{ t('loadWorkflowErrorDialog.extensionFileHint') }}</span>
      <br />
      <span class="font-bold">{{ extensionFile }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'

const { t } = useI18n()
const { error, stackTrace, extensionFile } = defineProps<{
  error: string
  stackTrace: string
  extensionFile?: string
}>()
</script>
