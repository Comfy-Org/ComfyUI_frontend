<template>
  <div ref="workflowTabRef" class="flex p-2 gap-2 workflow-tab" v-bind="$attrs">
    <span
      v-tooltip.bottom="workflowOption.workflow.key"
      class="workflow-label text-sm max-w-[150px] truncate inline-block"
    >
      {{ workflowOption.workflow.filename }}
    </span>
    <div class="relative">
      <span v-if="shouldShowStatusIndicator" class="status-indicator">•</span>
      <Button
        class="close-button p-0 w-auto"
        icon="pi pi-times"
        text
        severity="secondary"
        size="small"
        @click.stop="onCloseWorkflow(workflowOption)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  usePragmaticDraggable,
  usePragmaticDroppable
} from '@/composables/usePragmaticDragAndDrop'
import { useWorkflowService } from '@/services/workflowService'
import { useSettingStore } from '@/stores/settingStore'
import { ComfyWorkflow } from '@/stores/workflowStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const props = defineProps<{
  class?: string
  workflowOption: WorkflowOption
}>()

const { t } = useI18n()

const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const settingStore = useSettingStore()
const workflowTabRef = ref<HTMLElement | null>(null)

// Use computed refs to cache autosave settings
const autoSaveSetting = computed(() =>
  settingStore.get('Comfy.Workflow.AutoSave')
)
const autoSaveDelay = computed(() =>
  settingStore.get('Comfy.Workflow.AutoSaveDelay')
)

const shouldShowStatusIndicator = computed(() => {
  if (workspaceStore.shiftDown) {
    // Branch 1: Shift key is held down, do not show the status indicator.
    return false
  }
  if (!props.workflowOption.workflow.isPersisted) {
    // Branch 2: Workflow is not persisted, show the status indicator.
    return true
  }
  if (props.workflowOption.workflow.isModified) {
    // Branch 3: Workflow is modified.
    if (autoSaveSetting.value === 'off') {
      // Sub-branch 3a: Autosave is off, so show the status indicator.
      return true
    }
    if (autoSaveSetting.value === 'after delay' && autoSaveDelay.value > 3000) {
      // Sub-branch 3b: Autosave delay is too high, so show the status indicator.
      return true
    }
    // Sub-branch 3c: Workflow is modified but no condition applies, do not show the status indicator.
    return false
  }
  // Default: do not show the status indicator. This should not be reachable.
  return false
})

const closeWorkflows = async (options: WorkflowOption[]) => {
  for (const opt of options) {
    if (
      !(await useWorkflowService().closeWorkflow(opt.workflow, {
        warnIfUnsaved: !workspaceStore.shiftDown,
        hint: t('sideToolbar.workflowTab.dirtyCloseHint')
      }))
    ) {
      // User clicked cancel
      break
    }
  }
}

const onCloseWorkflow = async (option: WorkflowOption) => {
  await closeWorkflows([option])
}
const tabGetter = () => workflowTabRef.value as HTMLElement

usePragmaticDraggable(tabGetter, {
  getInitialData: () => {
    return {
      workflowKey: props.workflowOption.workflow.key
    }
  }
})

usePragmaticDroppable(tabGetter, {
  getData: () => {
    return {
      workflowKey: props.workflowOption.workflow.key
    }
  },
  onDrop: (e) => {
    const fromIndex = workflowStore.openWorkflows.findIndex(
      (wf) => wf.key === e.source.data.workflowKey
    )
    const toIndex = workflowStore.openWorkflows.findIndex(
      (wf) => wf.key === e.location.current.dropTargets[0]?.data.workflowKey
    )
    if (fromIndex !== toIndex) {
      workflowStore.reorderWorkflows(fromIndex, toIndex)
    }
  }
})
</script>

<style scoped>
.status-indicator {
  @apply absolute font-bold;
  font-size: 1.5rem;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
