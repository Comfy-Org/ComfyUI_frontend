<template>
  <div class="flex p-2 gap-2 workflow-tab" ref="workflowTabRef" v-bind="$attrs">
    <span
      class="workflow-label text-sm max-w-[150px] truncate inline-block"
      v-tooltip.bottom="workflowOption.workflow.key"
    >
      {{ workflowOption.workflow.filename }}
    </span>
    <div class="relative">
      <span class="status-indicator" v-if="shouldShowStatusIndicator">•</span>
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
  // Explanation:
  // 1. Check if the shift key is not pressed (!workspaceStore.shiftDown). If the shift key is pressed,
  //    we may want to override the status display.
  // 2. If the workflow is not persisted (!props.workflowOption.workflow.isPersisted),
  //    always show the indicator.
  // 3. Otherwise, if the workflow is modified, only show the indicator when:
  //    - Autosave is turned off, OR
  //    - Autosave is enabled ('after delay') and the delay is longer than 3000ms.
  return (
    !workspaceStore.shiftDown &&
    (!props.workflowOption.workflow.isPersisted ||
      (props.workflowOption.workflow.isModified &&
        (autoSaveSetting.value === 'off' ||
          (autoSaveSetting.value === 'after delay' &&
            autoSaveDelay.value > 3000))))
  )
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

const onCloseWorkflow = (option: WorkflowOption) => {
  closeWorkflows([option])
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
