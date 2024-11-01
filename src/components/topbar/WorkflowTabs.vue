<template>
  <SelectButton
    class="workflow-tabs bg-transparent flex flex-wrap"
    :class="props.class"
    :modelValue="selectedWorkflow"
    @update:modelValue="onWorkflowChange"
    :options="options"
    optionLabel="label"
    dataKey="value"
  >
    <template #option="{ option }">
      <span
        class="workflow-label text-sm max-w-[150px] truncate inline-block"
        v-tooltip="option.tooltip"
      >
        {{ option.label }}
      </span>
      <div class="relative">
        <span class="status-indicator" v-if="option.unsaved">•</span>
        <Button
          class="close-button p-0 w-auto"
          icon="pi pi-times"
          text
          severity="secondary"
          size="small"
          @click.stop="onCloseWorkflow(option)"
        />
      </div>
    </template>
  </SelectButton>
</template>

<script setup lang="ts">
import { app } from '@/scripts/app'
import { ComfyWorkflow } from '@/scripts/workflows'
import { useWorkflowStore } from '@/stores/workflowStore'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import { computed } from 'vue'

const props = defineProps<{
  class?: string
}>()

const workflowStore = useWorkflowStore()
interface WorkflowOption {
  label: string
  tooltip: string
  value: string
  unsaved: boolean
}

const workflowToOption = (workflow: ComfyWorkflow): WorkflowOption => ({
  label: workflow.name,
  tooltip: workflow.path,
  value: workflow.key,
  unsaved: workflow.unsaved
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
  workflowStore.closeWorkflow(workflow)
}
</script>

<style scoped>
:deep(.p-togglebutton::before) {
  @apply hidden;
}

:deep(.p-togglebutton) {
  @apply px-2 bg-transparent rounded-none flex-shrink-0 relative;
}

:deep(.p-togglebutton.p-togglebutton-checked) {
  @apply border-b-2;
  border-bottom-color: var(--p-button-text-primary-color);
}

:deep(.p-togglebutton-checked) .close-button,
:deep(.p-togglebutton:hover) .close-button {
  @apply visible;
}

.status-indicator {
  @apply absolute font-bold;
  font-size: 1.5rem;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

:deep(.p-togglebutton:hover) .status-indicator {
  @apply hidden;
}

:deep(.p-togglebutton) .close-button {
  @apply invisible;
}
</style>
