<template>
  <NoResultsPlaceholder
    icon="pi pi-exclamation-circle"
    :title="error.nodeType ?? 'UNKNOWN'"
    :message="error.exceptionMessage"
  />
  <div class="comfy-error-report">
    <template v-if="error.extensionFile">
      <span>{{ t('errorDialog.extensionFileHint') }}:</span>
      <br />
      <span class="font-bold">{{ error.extensionFile }}</span>
    </template>

    <div class="flex gap-2 justify-center">
      <Button
        v-show="!reportOpen"
        text
        :label="$t('g.showReport')"
        @click="showReport"
      />
      <Button
        v-show="!sendReportOpen"
        text
        :label="$t('issueReport.helpFix')"
        @click="showSendReport"
      />
    </div>
    <template v-if="reportOpen">
      <Divider />
      <ScrollPanel style="width: 100%; height: 400px; max-width: 80vw">
        <pre class="wrapper-pre">{{ reportContent }}</pre>
      </ScrollPanel>
      <Divider />
    </template>
    <ReportIssuePanel
      v-if="sendReportOpen"
      :title="$t('issueReport.submitErrorReport')"
      :error-type="error.reportType ?? 'unknownError'"
      :extra-fields="[stackTraceField]"
      :tags="{
        exceptionMessage: error.exceptionMessage,
        nodeType: error.nodeType ?? 'UNKNOWN'
      }"
    />
    <div class="action-container">
      <FindIssueButton
        :errorMessage="error.exceptionMessage"
        :repoOwner="repoOwner"
        :repoName="repoName"
      />
      <Button
        v-if="reportOpen"
        :label="$t('g.copyToClipboard')"
        icon="pi pi-copy"
        @click="copyReportToClipboard"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ScrollPanel from 'primevue/scrollpanel'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import FindIssueButton from '@/components/dialog/content/error/FindIssueButton.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import type { SystemStats } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { ReportField } from '@/types/issueReportTypes'
import {
  type ErrorReportData,
  generateErrorReport
} from '@/utils/errorReportUtil'

import ReportIssuePanel from './error/ReportIssuePanel.vue'

const { error } = defineProps<{
  error: Omit<ErrorReportData, 'workflow' | 'systemStats' | 'serverLogs'> & {
    /**
     * The type of error report to submit.
     * @default 'unknownError'
     */
    reportType?: string
    /**
     * The file name of the extension that caused the error.
     */
    extensionFile?: string
  }
}>()

const repoOwner = 'comfyanonymous'
const repoName = 'ComfyUI'
const reportContent = ref('')
const reportOpen = ref(false)
const showReport = () => {
  reportOpen.value = true
}
const sendReportOpen = ref(false)
const showSendReport = () => {
  sendReportOpen.value = true
}
const toast = useToast()
const { t } = useI18n()

const stackTraceField = computed<ReportField>(() => {
  return {
    label: t('issueReport.stackTrace'),
    value: 'StackTrace',
    optIn: true,
    getData: () => error.traceback?.join('\n')
  }
})

onMounted(async () => {
  try {
    const [systemStats, logs] = await Promise.all([
      api.getSystemStats(),
      api.getLogs()
    ])
    generateReport(systemStats, logs)
  } catch (error) {
    console.error('Error fetching system stats or logs:', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to fetch system information',
      life: 5000
    })
  }
})

const generateReport = (systemStats: SystemStats, logs: string) => {
  reportContent.value = generateErrorReport({
    systemStats,
    serverLogs: logs,
    workflow: app.graph.serialize(),
    exceptionType: error.exceptionType,
    exceptionMessage: error.exceptionMessage,
    traceback: error.traceback,
    nodeId: error.nodeId,
    nodeType: error.nodeType
  })
}

const { copyToClipboard } = useCopyToClipboard()
const copyReportToClipboard = async () => {
  await copyToClipboard(reportContent.value)
}
</script>

<style scoped>
.comfy-error-report {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-container {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.wrapper-pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
