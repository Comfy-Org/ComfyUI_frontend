<template>
  <div class="comfy-error-report flex flex-col gap-4">
    <NoResultsPlaceholder
      class="pb-0"
      icon="pi pi-exclamation-circle"
      :title="title"
      :message="error.exceptionMessage"
      :text-class="'break-words max-w-[60vw]'"
    />
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
      <Button
        v-if="authStore.currentUser"
        v-show="!reportOpen"
        text
        :label="$t('issueReport.contactSupportTitle')"
        @click="showContactSupport"
      />
    </div>
    <template v-if="reportOpen">
      <Divider />
      <ScrollPanel class="w-full h-[400px] max-w-[80vw]">
        <pre class="whitespace-pre-wrap break-words">{{ reportContent }}</pre>
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
    <div class="flex gap-4 justify-end">
      <FindIssueButton
        :error-message="error.exceptionMessage"
        :repo-owner="repoOwner"
        :repo-name="repoName"
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
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { ReportField } from '@/types/issueReportTypes'
import {
  type ErrorReportData,
  generateErrorReport
} from '@/utils/errorReportUtil'

import ReportIssuePanel from './error/ReportIssuePanel.vue'

const authStore = useFirebaseAuthStore()

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
const systemStatsStore = useSystemStatsStore()

const title = computed<string>(
  () => error.nodeType ?? error.exceptionType ?? t('errorDialog.defaultTitle')
)

const stackTraceField = computed<ReportField>(() => {
  return {
    label: t('issueReport.stackTrace'),
    value: 'StackTrace',
    optIn: true,
    getData: () => error.traceback
  }
})

const showContactSupport = async () => {
  await useCommandStore().execute('Comfy.ContactSupport')
}

onMounted(async () => {
  if (!systemStatsStore.systemStats) {
    await systemStatsStore.fetchSystemStats()
  }

  try {
    const [logs] = await Promise.all([api.getLogs()])

    reportContent.value = generateErrorReport({
      systemStats: systemStatsStore.systemStats!,
      serverLogs: logs,
      workflow: app.graph.serialize(),
      exceptionType: error.exceptionType,
      exceptionMessage: error.exceptionMessage,
      traceback: error.traceback,
      nodeId: error.nodeId,
      nodeType: error.nodeType
    })
  } catch (error) {
    console.error('Error fetching logs:', error)
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('toastMessages.failedToFetchLogs'),
      life: 5000
    })
  }
})

const { copyToClipboard } = useCopyToClipboard()
const copyReportToClipboard = async () => {
  await copyToClipboard(reportContent.value)
}
</script>
