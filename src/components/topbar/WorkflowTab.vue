<template>
  <div
    class="flex p-2 gap-2 workflow-tab"
    ref="workflowTabRef"
    v-bind="$attrs"
    @contextmenu="onContextMenu"
    @mousedown="onMouseDown"
  >
    <span
      class="workflow-label text-sm max-w-[150px] truncate inline-block"
      v-tooltip.bottom="tab.workflow.key"
    >
      {{ tab.workflow.filename }}
    </span>
    <div class="relative">
      <span
        class="status-indicator"
        v-if="
          !workspaceStore.shiftDown &&
          (tab.workflow.isModified || !tab.workflow.isPersisted)
        "
        >•</span
      >
      <Button
        class="close-button p-0 w-auto"
        icon="pi pi-times"
        text
        severity="secondary"
        size="small"
        @click.stop="onClose"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  usePragmaticDraggable,
  usePragmaticDroppable
} from '@/composables/usePragmaticDragAndDrop'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { WorkflowTabItem } from '@/types/tabTypes'

const props = defineProps<{
  tab: WorkflowTabItem
}>()

const emit = defineEmits<{
  (e: 'close', tab: WorkflowTabItem): void
  (e: 'contextmenu', event: MouseEvent, tab: WorkflowTabItem): void
  (e: 'middle-click', tab: WorkflowTabItem): void
  (e: 'reorder', fromTabId: string, toTabId: string): void
}>()

const { t } = useI18n()

const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const workflowTabRef = ref<HTMLElement | null>(null)

const onClose = () => {
  emit('close', props.tab)
}

const onContextMenu = (event: MouseEvent) => {
  emit('contextmenu', event, props.tab)
}

const onMouseDown = (event: MouseEvent) => {
  const isMiddleClick = event.button === 1
  if (isMiddleClick) emit('middle-click', props.tab)
}

const tabGetter = () => workflowTabRef.value as HTMLElement

usePragmaticDraggable(tabGetter, {
  getInitialData: () => {
    return {
      workflowKey: props.tab.workflow.key
    }
  }
})

usePragmaticDroppable(tabGetter, {
  getData: () => {
    return {
      workflowKey: props.tab.workflow.key
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
      emit(
        'reorder',
        workflowStore.openWorkflows[fromIndex].path,
        workflowStore.openWorkflows[toIndex].path
      )
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
