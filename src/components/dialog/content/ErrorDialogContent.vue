<template>
  <div class="load-workflow-error flex flex-col gap-4">
    <NoResultsPlaceholder
      class="pb-0"
      icon="pi pi-exclamation-circle"
      :title="title"
      :message="errorMessage"
    />
    <pre
      class="stack-trace p-5 text-neutral-400 text-xs max-h-[50vh] overflow-auto bg-black/20"
    >
      {{ stackTrace }}
    </pre>

    <template v-if="extensionFile">
      <span>{{ t('errorDialog.extensionFileHint') }}:</span>
      <br />
      <span class="font-bold">{{ extensionFile }}</span>
    </template>

    <ReportIssuePanel
      :error-type="errorType"
      :extra-fields="[
        {
          label: t('issueReport.stackTrace'),
          value: 'StackTrace',
          optIn: true,
          getData: () => stackTrace
        }
      ]"
      :tags="{
        exceptionMessage: errorMessage,
        extensionFile: extensionFile ?? 'UNKNOWN'
      }"
      :title="t('issueReport.submitErrorReport')"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'

import ReportIssuePanel from './error/ReportIssuePanel.vue'

const { t } = useI18n()
const {
  title = t('errorDialog.defaultTitle'),
  errorMessage,
  stackTrace = t('errorDialog.noStackTrace'),
  extensionFile,
  errorType = 'frontendError'
} = defineProps<{
  title?: string
  errorMessage: string
  stackTrace?: string
  extensionFile?: string
  errorType?: string
}>()
</script>
