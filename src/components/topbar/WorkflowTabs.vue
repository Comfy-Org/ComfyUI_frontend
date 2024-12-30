<template>
  <SelectButton
    class="workflow-tabs bg-transparent inline"
    :class="props.class"
    :modelValue="selectedWorkflow"
    @update:modelValue="onWorkflowChange"
    :options="options"
    optionLabel="label"
    dataKey="value"
  >
    <template #option="{ option }">
      <WorkflowTab
        @contextmenu="showContextMenu($event, option)"
        @click.middle="onCloseWorkflow(option)"
        :workflow-option="option"
      />
    </template>
  </SelectButton>
  <Button
    class="new-blank-workflow-button"
    icon="pi pi-plus"
    text
    severity="secondary"
    @click="() => commandStore.execute('Comfy.NewBlankWorkflow')"
  />
  <ContextMenu ref="menu" :model="contextMenuItems" />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowTab from '@/components/topbar/WorkflowTab.vue'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { ComfyWorkflow } from '@/stores/workflowStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const props = defineProps<{
  class?: string
}>()

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const rightClickedTab = ref<WorkflowOption>(null)
const menu = ref()

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

const closeWorkflows = async (options: WorkflowOption[]) => {
  for (const opt of options) {
    if (
      !(await workflowService.closeWorkflow(opt.workflow, {
        warnIfUnsaved: !workspaceStore.shiftDown
      }))
    ) {
      // User clicked cancel
      break
    }
  }
}

const onCloseWorkflow = (option: WorkflowOption) => {
  closeWorkflows([option])
}

const showContextMenu = (event, option) => {
  rightClickedTab.value = option
  menu.value.show(event)
}
const contextMenuItems = computed(() => {
  const tab = rightClickedTab.value as WorkflowOption
  if (!tab) return []
  const index = options.value.findIndex((v) => v.workflow === tab.workflow)

  return [
    {
      label: t('tabMenu.duplicateTab'),
      command: () => {
        workflowService.duplicateWorkflow(tab.workflow)
      }
    },
    {
      separator: true
    },
    {
      label: t('tabMenu.closeTab'),
      command: () => onCloseWorkflow(tab)
    },
    {
      label: t('tabMenu.closeTabsToLeft'),
      command: () => closeWorkflows(options.value.slice(0, index)),
      disabled: index <= 0
    },
    {
      label: t('tabMenu.closeTabsToRight'),
      command: () => closeWorkflows(options.value.slice(index + 1)),
      disabled: index === options.value.length - 1
    },
    {
      label: t('tabMenu.closeOtherTabs'),
      command: () =>
        closeWorkflows([
          ...options.value.slice(index + 1),
          ...options.value.slice(0, index)
        ]),
      disabled: options.value.length <= 1
    }
  ]
})
const commandStore = useCommandStore()
</script>

<style scoped>
:deep(.p-togglebutton::before) {
  @apply hidden;
}

:deep(.p-togglebutton) {
  @apply p-0 bg-transparent rounded-none flex-shrink-0 relative;
}

:deep(.p-togglebutton.p-togglebutton-checked) {
  @apply border-b-2;
  border-bottom-color: var(--p-button-text-primary-color);
}

:deep(.p-togglebutton-checked) .close-button,
:deep(.p-togglebutton:hover) .close-button {
  @apply visible;
}

:deep(.p-togglebutton:hover) .status-indicator {
  @apply hidden;
}

:deep(.p-togglebutton) .close-button {
  @apply invisible;
}
</style>
