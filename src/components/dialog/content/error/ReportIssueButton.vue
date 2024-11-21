<template>
  <Button
    @click="reportIssue"
    :label="$t('reportIssue')"
    :severity="submitted ? 'success' : 'secondary'"
    :icon="icon"
    :disabled="submitted"
    v-tooltip="$t('reportIssueTooltip')"
  >
  </Button>
</template>

<script setup lang="ts">
import { computed, ref, defineProps } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ExecutionErrorWsMessage } from '@/types/apiTypes'
import { useI18n } from 'vue-i18n'
import { electronAPI } from '@/utils/envUtil'

const { error } = defineProps<{
  error: ExecutionErrorWsMessage
}>()

const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const submitted = ref(false)
const icon = computed(
  () => `pi ${submitting.value ? 'pi-spin pi-spinner' : 'pi-send'}`
)

const reportIssue = async () => {
  if (submitting.value) return
  submitting.value = true
  try {
    await electronAPI().sendErrorToSentry(error.exception_message, {
      stackTrace: error.traceback?.join('\n'),
      nodeType: error.node_type
    })
    submitted.value = true
    toast.add({
      severity: 'success',
      summary: t('reportSent'),
      life: 3000
    })
  } finally {
    submitting.value = false
  }
}
</script>
