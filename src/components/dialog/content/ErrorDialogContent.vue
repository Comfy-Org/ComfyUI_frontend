<template>
  <div class="error-dialog-content flex flex-col gap-4">
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

    <Button
      v-show="!sendReportOpen"
      text
      fluid
      :label="$t('issueReport.helpFix')"
      @click="showSendReport"
    />

    <ReportIssuePanel
      v-if="sendReportOpen"
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
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'

import ReportIssuePanel from './error/ReportIssuePanel.vue'

const { t } = useI18n()
const {
  title: _title,
  errorMessage,
  stackTrace: _stackTrace,
  extensionFile,
  errorType = 'frontendError'
} = defineProps<{
  title?: string
  errorMessage: string
  stackTrace?: string
  extensionFile?: string
  errorType?: string
}>()

const title = computed(() => _title ?? t('errorDialog.defaultTitle'))
const stackTrace = computed(() => _stackTrace ?? t('errorDialog.noStackTrace'))

const sendReportOpen = ref(false)
function showSendReport() {
  sendReportOpen.value = true
}
</script>
