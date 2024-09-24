<template>
  <div class="workflow-tabs">
    <SelectButton
      :modelValue="selectedWorkflow"
      @update:modelValue="onWorkflowChange"
      :options="options"
      optionLabel="label"
      dataKey="value"
    />
  </div>
</template>

<script setup lang="ts">
import { ComfyWorkflow } from '@/scripts/workflows'
import { useWorkflowStore } from '@/stores/workflowStore'
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'

const workflowStore = useWorkflowStore()
interface WorkflowOption {
  label: string
  value: string
}

const workflowToOption = (workflow: ComfyWorkflow): WorkflowOption => ({
  label: workflow.name,
  value: workflow.key
})

const optionToWorkflow = (option: WorkflowOption): ComfyWorkflow =>
  workflowStore.workflowLookup[option.value]

const options = computed<WorkflowOption[]>(() =>
  workflowStore.openWorkflows.map(workflowToOption)
)
const selectedWorkflow = computed<WorkflowOption | null>(() =>
  workflowStore.activeWorkflow
    ? workflowToOption(workflowStore.activeWorkflow as ComfyWorkflow)
    : null
)
const onWorkflowChange = (option: WorkflowOption) => {
  const workflow = optionToWorkflow(option)
  workflow.load()
}
</script>
