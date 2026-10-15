<template>
  <div />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { isReloadingForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'

const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()

function draftsCarryUnsavedWork() {
  return (
    settingStore.get('Comfy.Workflow.Persist') &&
    isReloadingForDeploymentSwitch()
  )
}

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (
    settingStore.get('Comfy.Window.UnloadConfirmation') &&
    workflowStore.modifiedWorkflows.length > 0 &&
    !draftsCarryUnsavedWork()
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
