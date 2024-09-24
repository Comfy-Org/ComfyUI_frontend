<template>
  <div class="workflow-tabs">
    <SelectButton
      class="bg-transparent"
      :modelValue="selectedWorkflow"
      @update:modelValue="onWorkflowChange"
      :options="options"
      optionLabel="label"
      dataKey="value"
    >
      <template #option="{ option }">
        <span class="text-sm">{{ option.label }}</span>
        <Button
          class="close-button p-0 w-auto invisible"
          icon="pi pi-times"
          text
          severity="secondary"
          size="small"
          @click.stop="onCloseWorkflow(option)"
        />
      </template>
    </SelectButton>
  </div>
</template>

<script setup lang="ts">
import { app } from '@/scripts/app'
import { ComfyWorkflow } from '@/scripts/workflows'
import { useWorkflowStore } from '@/stores/workflowStore'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
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
  // Prevent unselecting the current workflow
  if (!option) {
    return
  }
  // Prevent reloading the current workflow
  if (selectedWorkflow.value?.value === option.value) {
    return
  }

  const workflow = optionToWorkflow(option)
  workflow.load()
}

const onCloseWorkflow = (option: WorkflowOption) => {
  const workflow = optionToWorkflow(option)
  app.workflowManager.closeWorkflow(workflow)
}
</script>

<style scoped>
:deep(.p-togglebutton::before) {
  @apply hidden;
}

:deep(.p-togglebutton) {
  @apply px-2 bg-transparent rounded-none;
}

:deep(.p-togglebutton.p-togglebutton-checked) {
  @apply border-b-2;
  border-bottom-color: var(--p-button-text-primary-color);
}

:deep(.p-togglebutton-checked) .close-button,
:deep(.p-togglebutton:hover) .close-button {
  @apply visible;
}
</style>
