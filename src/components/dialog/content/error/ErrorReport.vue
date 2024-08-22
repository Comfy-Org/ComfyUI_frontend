<template>
  <div class="error-report">
    <Button
      v-show="!reportOpen"
      :label="$t('showReport')"
      @click="showReport"
      text
    />
    <template v-if="reportOpen">
      <Divider />
      <ScrollPanel style="width: 100%; max-height: 70vh">
        <pre>{{ reportContent }}</pre>
      </ScrollPanel>
      <Divider />
    </template>

    <div class="action-container">
      <FindIssueButton
        :errorMessage="props.error.exception_message"
        repoOwner="comfyanonymous"
        repoName="ComfyUI"
      />
      <Button
        label="Open GitHub Issue"
        icon="pi pi-external-link"
        @click="openGitHubIssue"
        class="p-button-secondary"
      />
      <Button
        label="Copy to Clipboard"
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
import FindIssueButton from './FindIssueButton.vue'
import type { ExecutionErrorWsMessage, SystemStats } from '@/types/apiTypes'
import { api } from '@/scripts/api'

const props = defineProps<{
  error: ExecutionErrorWsMessage
}>()

const reportContent = ref('')
const reportOpen = ref(false)
const showReport = () => {
  reportOpen.value = true
}

const toast = useToast()
const { copy, isSupported } = useClipboard()

onMounted(async () => {
  generateReport(await api.getSystemStats())
})

const generateReport = (systemStats: SystemStats) => {
  reportContent.value = `
# ComfyUI Error Report
## Error Details
- **Node Type:** ${props.error.node_type}
- **Exception Type:** ${props.error.exception_type}
- **Exception Message:** ${props.error.exception_message}
## Stack Trace
\`\`\`
${props.error.traceback.join('\n')}
\`\`\`
## System Information
- **OS:** ${systemStats.system.os}
- **Python Version:** ${systemStats.system.python_version}
- **Embedded Python:** ${systemStats.system.embedded_python}
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
        detail: 'Failed to copy report',
        life: 3000
      })
    }
  } else {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Clipboard API not supported in your browser',
      life: 3000
    })
  }
}

const openGitHubIssue = () => {
  const issueTitle = encodeURIComponent(
    `[Bug]: ${props.error.exception_type} in ${props.error.node_type}`
  )
  const issueBody = encodeURIComponent(reportContent.value)
  const url = `https://github.com/comfyanonymous/ComfyUI/issues/new?title=${issueTitle}&body=${issueBody}`
  window.open(url, '_blank')
}
</script>

<style scoped>
.error-report {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-container {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
