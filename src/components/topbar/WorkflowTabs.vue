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
        v-tooltip.bottom="option.workflow.key"
      >
        {{ option.workflow.filename }}
      </span>
      <div class="relative">
        <span
          class="status-indicator"
          v-if="!workspaceStore.shiftDown && option.workflow.isModified"
          >•</span
        >
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
import { ComfyWorkflow } from '@/stores/workflowStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import { computed } from 'vue'
import { workflowService } from '@/services/workflowService'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const props = defineProps<{
  class?: string
}>()

const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const workflowToOption = (workflow: ComfyWorkflow): WorkflowOption => ({
  value: workflow.path,
  workflow
})

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

  workflowService.openWorkflow(option.workflow)
}

const onCloseWorkflow = (option: WorkflowOption) => {
  workflowService.closeWorkflow(option.workflow, {
    warnIfUnsaved: !workspaceStore.shiftDown
  })
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
