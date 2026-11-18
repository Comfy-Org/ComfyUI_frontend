<template>
  <div />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { takeLeavePromptSkip } from '@/platform/workflow/management/leavePrompt'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (takeLeavePromptSkip()) return undefined
  if (
    settingStore.get('Comfy.Window.UnloadConfirmation') &&
    workflowStore.modifiedWorkflows.length > 0
  ) {
    event.preventDefault()
    return true
  }
  return undefined
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>
