<template>
  <div class="workflow-tabs-container flex flex-row max-w-full h-full">
    <ScrollPanel
      ref="scrollPanelRef"
      class="overflow-hidden no-drag"
      :pt:content="{
        class: 'p-0 w-full',
        onwheel: handleWheel
      }"
      pt:bar-x="h-1"
    >
      <SelectButton
        class="workflow-tabs bg-transparent"
        :class="props.class"
        :model-value="selectedWorkflow"
        :options="options"
        option-label="label"
        data-key="value"
        @update:model-value="onWorkflowChange"
      >
        <template #option="{ option }">
          <WorkflowTab
            :workflow-option="option"
            @contextmenu="showContextMenu($event, option)"
            @click.middle="onCloseWorkflow(option)"
          />
        </template>
      </SelectButton>
    </ScrollPanel>
    <Button
      v-tooltip="{ value: $t('sideToolbar.newBlankWorkflow'), showDelay: 300 }"
      class="new-blank-workflow-button flex-shrink-0 no-drag"
      icon="pi pi-plus"
      text
      severity="secondary"
      :aria-label="$t('sideToolbar.newBlankWorkflow')"
      @click="() => commandStore.execute('Comfy.NewBlankWorkflow')"
    />
    <ContextMenu ref="menu" :model="contextMenuItems" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import ScrollPanel from 'primevue/scrollpanel'
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowTab from '@/components/topbar/WorkflowTab.vue'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { ComfyWorkflow, useWorkflowBookmarkStore } from '@/stores/workflowStore'
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
const workflowBookmarkStore = useWorkflowBookmarkStore()
const rightClickedTab = ref<WorkflowOption | undefined>()
const menu = ref()
const scrollPanelRef = ref()

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
const onWorkflowChange = async (option: WorkflowOption) => {
  // Prevent unselecting the current workflow
  if (!option) {
    return
  }
  // Prevent reloading the current workflow
  if (selectedWorkflow.value?.value === option.value) {
    return
  }

  await workflowService.openWorkflow(option.workflow)
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

const onCloseWorkflow = async (option: WorkflowOption) => {
  await closeWorkflows([option])
}

const showContextMenu = (event: MouseEvent, option: WorkflowOption) => {
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
      command: async () => {
        await workflowService.duplicateWorkflow(tab.workflow)
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
    },
    {
      label: workflowBookmarkStore.isBookmarked(tab.workflow.path)
        ? t('tabMenu.removeFromBookmarks')
        : t('tabMenu.addToBookmarks'),
      command: () => workflowBookmarkStore.toggleBookmarked(tab.workflow.path),
      disabled: tab.workflow.isTemporary
    }
  ]
})
const commandStore = useCommandStore()

// Horizontal scroll on wheel
const handleWheel = (event: WheelEvent) => {
  const scrollElement = event.currentTarget as HTMLElement
  const scrollAmount = event.deltaX || event.deltaY
  scrollElement.scroll({
    left: scrollElement.scrollLeft + scrollAmount
  })
}

// Scroll to active offscreen tab when opened
watch(
  () => workflowStore.activeWorkflow,
  async () => {
    if (!selectedWorkflow.value) return

    await nextTick()

    const activeTabElement = document.querySelector('.p-togglebutton-checked')
    if (!activeTabElement || !scrollPanelRef.value) return

    const container = scrollPanelRef.value.$el.querySelector(
      '.p-scrollpanel-content'
    )
    if (!container) return

    const tabRect = activeTabElement.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    const offsetLeft = tabRect.left - containerRect.left
    const offsetRight = tabRect.right - containerRect.right

    if (offsetRight > 0) {
      container.scrollBy({ left: offsetRight })
    } else if (offsetLeft < 0) {
      container.scrollBy({ left: offsetLeft })
    }
  },
  { immediate: true }
)
</script>

<style scoped>
:deep(.p-togglebutton) {
  @apply p-0 bg-transparent rounded-none flex-shrink-0 relative border-0 border-r border-solid;
  border-right-color: var(--border-color);
}

:deep(.p-togglebutton::before) {
  @apply hidden;
}

:deep(.p-togglebutton:first-child) {
  @apply border-l border-solid;
  border-left-color: var(--border-color);
}

:deep(.p-togglebutton:not(:first-child)) {
  @apply border-l-0;
}

:deep(.p-togglebutton.p-togglebutton-checked) {
  @apply border-b border-solid h-full;
  border-bottom-color: var(--p-button-text-primary-color);
}

:deep(.p-togglebutton:not(.p-togglebutton-checked)) {
  @apply opacity-75;
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

:deep(.p-scrollpanel-content) {
  @apply h-full;
}

/* Scrollbar half opacity to avoid blocking the active tab bottom border */
:deep(.p-scrollpanel:hover .p-scrollpanel-bar),
:deep(.p-scrollpanel:active .p-scrollpanel-bar) {
  @apply opacity-50;
}

:deep(.p-selectbutton) {
  @apply rounded-none h-full;
}
</style>
