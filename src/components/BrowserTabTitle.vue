<template>
  <div>
    <!-- This component does not render anything visible. -->
  </div>
</template>

<script setup lang="ts">
import { useExecutionStore } from '@/stores/executionStore'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useTitle } from '@vueuse/core'
import { computed } from 'vue'

const DEFAULT_TITLE = 'ComfyUI'
const executionStore = useExecutionStore()
const executionText = computed(() =>
  executionStore.isIdle ? '' : `[${executionStore.executionProgress}%]`
)

const settingStore = useSettingStore()
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)

const workflowStore = useWorkflowStore()
const isUnsavedText = computed(() =>
  workflowStore.previousWorkflowUnsaved ? ' *' : ''
)
const workflowNameText = computed(() => {
  const workflowName = workflowStore.activeWorkflow?.name
  return workflowName ? isUnsavedText.value + workflowName : DEFAULT_TITLE
})

const title = computed(
  () =>
    executionText.value +
    (betaMenuEnabled.value ? workflowNameText.value : DEFAULT_TITLE)
)
useTitle(title)
</script>
