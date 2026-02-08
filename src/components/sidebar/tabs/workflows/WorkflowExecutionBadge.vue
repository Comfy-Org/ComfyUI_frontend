<script setup lang="ts">
import { computed } from 'vue'

import WorkflowExecutionIndicator from '@/components/topbar/WorkflowExecutionIndicator.vue'
import { useWorkflowExecutionState } from '@/composables/useWorkflowExecutionState'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

const { workflow } = defineProps<{ workflow?: ComfyWorkflow }>()

const workflowId = computed(() => {
  return workflow?.activeState?.id ?? workflow?.initialState?.id
})

const { state } = useWorkflowExecutionState(workflowId)
const showIndicator = computed(() => state.value !== 'idle')
</script>

<template>
  <WorkflowExecutionIndicator v-if="showIndicator" :state="state" />
</template>
