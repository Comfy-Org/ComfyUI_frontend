<template>
  <div
    class="workflow-tabs-container flex flex-row max-w-full h-full flex-auto overflow-hidden"
    :class="{ 'workflow-tabs-container-desktop': isDesktop }"
  >
    <Button
      v-if="showOverflowArrows"
      icon="pi pi-chevron-left"
      text
      severity="secondary"
      class="overflow-arrow overflow-arrow-left"
      :disabled="!leftArrowEnabled"
      @mousedown="whileMouseDown($event, () => scroll(-1))"
    />
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
      v-if="showOverflowArrows"
      icon="pi pi-chevron-right"
      text
      severity="secondary"
      class="overflow-arrow overflow-arrow-right"
      :disabled="!rightArrowEnabled"
      @mousedown="whileMouseDown($event, () => scroll(1))"
    />
    <Button
      v-tooltip="{ value: $t('sideToolbar.newBlankWorkflow'), showDelay: 300 }"
      class="new-blank-workflow-button flex-shrink-0 no-drag rounded-none"
      icon="pi pi-plus"
      text
      severity="secondary"
      :aria-label="$t('sideToolbar.newBlankWorkflow')"
      @click="() => commandStore.execute('Comfy.NewBlankWorkflow')"
    />
    <ContextMenu ref="menu" :model="contextMenuItems" />
    <div
      v-if="menuSetting !== 'Bottom' && isDesktop"
      class="window-actions-spacer flex-shrink-0 app-drag"
    />
  </div>
</template>

<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import ScrollPanel from 'primevue/scrollpanel'
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, onUpdated, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowTab from '@/components/topbar/WorkflowTab.vue'
import { useOverflowObserver } from '@/composables/element/useOverflowObserver'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useSettingStore } from '@/stores/settingStore'
import { ComfyWorkflow, useWorkflowBookmarkStore } from '@/stores/workflowStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { isElectron } from '@/utils/envUtil'
import { whileMouseDown } from '@/utils/mouseDownUtil'

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
const workflowBookmarkStore = useWorkflowBookmarkStore()
const settingStore = useSettingStore()
const workflowService = useWorkflowService()

const rightClickedTab = ref<WorkflowOption | undefined>()
const menu = ref()
const scrollPanelRef = ref()
const showOverflowArrows = ref(false)
const leftArrowEnabled = ref(false)
const rightArrowEnabled = ref(false)

const isDesktop = isElectron()
const menuSetting = computed(() => settingStore.get('Comfy.UseNewMenu'))

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

const scroll = (direction: number) => {
  const scrollElement = scrollPanelRef.value.$el.querySelector(
    '.p-scrollpanel-content'
  ) as HTMLElement
  scrollElement.scrollBy({ left: direction * 20 })
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

const scrollContent = computed(
  () =>
    scrollPanelRef.value?.$el.querySelector(
      '.p-scrollpanel-content'
    ) as HTMLElement
)
let overflowObserver: ReturnType<typeof useOverflowObserver> | null = null
let overflowWatch: ReturnType<typeof watch> | null = null
watch(scrollContent, (value) => {
  const scrollState = useScroll(value)

  watch(scrollState.arrivedState, () => {
    leftArrowEnabled.value = !scrollState.arrivedState.left
    rightArrowEnabled.value = !scrollState.arrivedState.right
  })

  overflowObserver?.dispose()
  overflowWatch?.stop()
  overflowObserver = useOverflowObserver(value)
  overflowWatch = watch(
    overflowObserver.isOverflowing,
    (value) => {
      showOverflowArrows.value = value
      void nextTick(() => {
        // Force a new check after arrows are updated
        scrollState.measure()
      })
    },
    { immediate: true }
  )
})

onUpdated(() => {
  if (!overflowObserver?.disposed.value) {
    overflowObserver?.checkOverflow()
  }
})
</script>

<style scoped>
.workflow-tabs-container {
  background-color: var(--comfy-menu-secondary-bg);
}

:deep(.p-togglebutton) {
  @apply p-0 bg-transparent rounded-none flex-shrink relative border-0 border-r border-solid;
  border-right-color: var(--border-color);
  min-width: 90px;
}

.overflow-arrow {
  @apply px-2 rounded-none;
}

.overflow-arrow[disabled] {
  @apply opacity-25;
}

:deep(.p-togglebutton > .p-togglebutton-content) {
  @apply max-w-full;
}

:deep(.workflow-tab) {
  @apply max-w-full;
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

:deep(.workflow-tabs) {
  display: flex;
}

/* Scrollbar half opacity to avoid blocking the active tab bottom border */
:deep(.p-scrollpanel:hover .p-scrollpanel-bar),
:deep(.p-scrollpanel:active .p-scrollpanel-bar) {
  @apply opacity-50;
}

:deep(.p-selectbutton) {
  @apply rounded-none h-full;
}

.workflow-tabs-container-desktop {
  max-width: env(titlebar-area-width, 100vw);
}

.window-actions-spacer {
  @apply flex-auto;
  /* If we are using custom titlebar, then we need to add a gap for the user to drag the window */
  --window-actions-spacer-width: min(75px, env(titlebar-area-width, 0) * 9999);
  min-width: var(--window-actions-spacer-width);
}
</style>
