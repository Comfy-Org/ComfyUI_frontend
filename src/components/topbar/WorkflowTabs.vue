<template>
  <div class="workflow-tabs">
    <SelectButton
      class="select-button-group bg-transparent"
      :modelValue="selectedWorkflow"
      @update:modelValue="onWorkflowChange"
      :options="options"
      optionLabel="label"
      dataKey="value"
    >
      <template #option="{ option }">
        <span class="text-sm max-w-[150px] truncate inline-block">{{
          option.label
        }}</span>
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
.select-button-group {
  max-width: 70vw;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* Internet Explorer 10+ */
}

.select-button-group::-webkit-scrollbar {
  display: none; /* WebKit */
}

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
