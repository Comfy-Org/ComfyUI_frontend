<template>
  <div />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import {
  takeDeploymentSwitchDiscard,
  wasDiscardedOnSwitch
} from '@/platform/workspace/deploymentSwitchReload'

const settingStore = useSettingStore()
const workflowStore = useWorkflowStore()

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  const discarded = takeDeploymentSwitchDiscard()
  const leavesUnsavedWork = workflowStore.modifiedWorkflows.some(
    (workflow) => !wasDiscardedOnSwitch(discarded, workflow)
  )
  if (
    settingStore.get('Comfy.Window.UnloadConfirmation') &&
    leavesUnsavedWork
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
