<template>
  <NoResultsPlaceholder
    icon="pi pi-exclamation-circle"
    :title="props.error.node_type"
    :message="props.error.exception_message"
  />
  <div class="comfy-error-report">
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
      error-type="graphExecutionError"
      :extra-fields="[stackTraceField]"
      :tags="{
        exceptionMessage: props.error.exception_message,
        nodeType: props.error.node_type
      }"
    />
    <div class="action-container">
      <FindIssueButton
        :errorMessage="props.error.exception_message"
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
import type { ExecutionErrorWsMessage, SystemStats } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { ReportField } from '@/types/issueReportTypes'

import ReportIssuePanel from './error/ReportIssuePanel.vue'

const props = defineProps<{
  error: ExecutionErrorWsMessage
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
    getData: () => props.error.traceback?.join('\n')
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
  // The default JSON workflow has about 3000 characters.
  const MAX_JSON_LENGTH = 20000
  const workflowJSONString = JSON.stringify(app.graph.serialize())
  const workflowText =
    workflowJSONString.length > MAX_JSON_LENGTH
      ? 'Workflow too large. Please manually upload the workflow from local file system.'
      : workflowJSONString

  reportContent.value = `
# ComfyUI Error Report
## Error Details
- **Node ID:** ${props.error.node_id}
- **Node Type:** ${props.error.node_type}
- **Exception Type:** ${props.error.exception_type}
- **Exception Message:** ${props.error.exception_message}
## Stack Trace
\`\`\`
${props.error.traceback.join('\n')}
\`\`\`
## System Information
- **ComfyUI Version:** ${systemStats.system.comfyui_version}
- **Arguments:** ${systemStats.system.argv.join(' ')}
- **OS:** ${systemStats.system.os}
- **Python Version:** ${systemStats.system.python_version}
- **Embedded Python:** ${systemStats.system.embedded_python}
- **PyTorch Version:** ${systemStats.system.pytorch_version}
## Devices
${systemStats.devices
  .map(
    (device) => `
- **Name:** ${device.name}
  - **Type:** ${device.type}
  - **VRAM Total:** ${device.vram_total}
  - **VRAM Free:** ${device.vram_free}
  - **Torch VRAM Total:** ${device.torch_vram_total}
  - **Torch VRAM Free:** ${device.torch_vram_free}
`
  )
  .join('\n')}
## Logs
\`\`\`
${logs}
\`\`\`
## Attached Workflow
Please make sure that workflow does not contain any sensitive information such as API keys or passwords.
\`\`\`
${workflowText}
\`\`\`

## Additional Context
(Please add any additional context or steps to reproduce the error here)
`
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
