<template>
  <NoResultsPlaceholder
    icon="pi pi-exclamation-circle"
    :title="props.error.node_type"
    :message="props.error.exception_message"
  />
  <div class="comfy-error-report">
    <Button
      v-show="!reportOpen"
      :label="$t('showReport')"
      @click="showReport"
      text
    />
    <template v-if="reportOpen">
      <Divider />
      <ScrollPanel style="width: 100%; height: 400px; max-width: 80vw">
        <pre class="wrapper-pre">{{ reportContent }}</pre>
      </ScrollPanel>
      <Divider />
    </template>

    <div class="action-container">
      <ReportIssueButton v-if="showSendError" :error="props.error" />
      <FindIssueButton
        :errorMessage="props.error.exception_message"
        :repoOwner="repoOwner"
        :repoName="repoName"
      />
      <Button
        v-if="reportOpen"
        :label="$t('copyToClipboard')"
        icon="pi pi-copy"
        @click="copyReportToClipboard"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import ScrollPanel from 'primevue/scrollpanel'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import FindIssueButton from '@/components/dialog/content/error/FindIssueButton.vue'
import ReportIssueButton from '@/components/dialog/content/error/ReportIssueButton.vue'
import type { ExecutionErrorWsMessage, SystemStats } from '@/types/apiTypes'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { isElectron } from '@/utils/envUtil'

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
const showSendError = isElectron()

const toast = useToast()
const { copy, isSupported } = useClipboard()

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

const copyReportToClipboard = async () => {
  if (isSupported) {
    try {
      await copy(reportContent.value)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Report copied to clipboard',
        life: 3000
      })
    } catch (err) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to copy report'
      })
    }
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Clipboard API not supported in your browser'
    })
  }
}

const openNewGithubIssue = async () => {
  await copyReportToClipboard()
  const issueTitle = encodeURIComponent(
    `[Bug]: ${props.error.exception_type} in ${props.error.node_type}`
  )
  const issueBody = encodeURIComponent(
    'The report has been copied to the clipboard. Please paste it here.'
  )
  const url = `https://github.com/${repoOwner}/${repoName}/issues/new?title=${issueTitle}&body=${issueBody}`
  window.open(url, '_blank')
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
