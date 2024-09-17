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

const executionStore = useExecutionStore()
const executionText = computed(() =>
  executionStore.isIdle ? '' : `[${executionStore.executionProgress}%]`
)

const settingStore = useSettingStore()
const betaMenuEnabled = computed(
  () => settingStore.get('Comfy.UseNewMenu') !== 'Disabled'
)

const workflowStore = useWorkflowStore()
const workflowNameText = computed(
  () =>
    (betaMenuEnabled.value ? workflowStore.activeWorkflow?.name : undefined) ??
    'ComfyUI'
)

const title = computed(() => executionText.value + workflowNameText.value)
useTitle(title)
</script>
