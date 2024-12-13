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
      <div
        class="flex p-2 gap-2"
        @contextmenu="showContextMenu($event, option)"
        @click.middle="onCloseWorkflow(option)"
      >
        <span
          class="workflow-label text-sm max-w-[150px] truncate inline-block"
          v-tooltip.bottom="option.workflow.key"
        >
          {{ option.workflow.filename }}
        </span>
        <div class="relative">
          <span
            class="status-indicator"
            v-if="
              !workspaceStore.shiftDown &&
              (option.workflow.isModified || !option.workflow.isPersisted)
            "
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
      </div>
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
import { ComfyWorkflow } from '@/stores/workflowStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { workflowService } from '@/services/workflowService'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import ContextMenu from 'primevue/contextmenu'
import { useI18n } from 'vue-i18n'

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
const rightClickedTab = ref<WorkflowOption>(null)
const menu = ref()

const showContextMenu = (event, option) => {
  rightClickedTab.value = option
  menu.value.show(event)
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
