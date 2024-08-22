<template>
  <div class="error-content">
    <h3>Error in {{ error.node_type }}</h3>
    <p>{{ error.exception_message }}</p>
    <Divider />
    <h4>Stack Trace</h4>
    <Button
      @click="toggleStackTrace"
      :label="showStackTrace ? 'Hide Stack Trace' : 'Show Stack Trace'"
      class="p-button-text"
    />
    <ScrollPanel v-if="showStackTrace" style="width: 100%; max-height: 300px">
      <pre>{{ error.traceback }}</pre>
    </ScrollPanel>
    <Button
      label="Generate Report"
      icon="pi pi-file"
      @click="openReportDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import ScrollPanel from 'primevue/scrollpanel'
import Divider from 'primevue/divider'
import { ExecutionErrorWsMessage } from '@/types/apiTypes'

const props = defineProps<{
  error: ExecutionErrorWsMessage
}>()
const error = props.error

const emit = defineEmits(['generateReport'])

const showStackTrace = ref(false)

const openReportDialog = () => {
  emit('generateReport')
}

const toggleStackTrace = (): void => {
  showStackTrace.value = !showStackTrace.value
}
</script>
