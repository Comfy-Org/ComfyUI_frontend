<template>
  <ScrollPanel style="width: 100%; height: 70vh">
    <pre>{{ reportContent }}</pre>
  </ScrollPanel>
  <Button
    label="Copy to Clipboard"
    icon="pi pi-copy"
    @click="copyReportToClipboard"
  />
  <FindIssueButton
    :errorMessage="props.error.exception_message"
    repoOwner="comfyanonymous"
    repoName="ComfyUI"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ScrollPanel from 'primevue/scrollpanel'
import FindIssueButton from './error/FindIssueButton.vue'

const props = defineProps({
  error: {
    type: Object,
    required: true
  },
  systemStats: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const reportContent = ref('')

const toast = useToast()
const { copy, isSupported } = useClipboard()

onMounted(() => {
  generateReport()
})

const generateReport = () => {
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
- **OS:** ${props.systemStats.system.os}
- **Python Version:** ${props.systemStats.system.python_version}
- **Embedded Python:** ${props.systemStats.system.embedded_python}

## Devices
${props.systemStats.devices
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
</script>
