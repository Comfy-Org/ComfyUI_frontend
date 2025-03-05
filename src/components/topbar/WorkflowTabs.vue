<template>
  <div class="workflow-tabs-container flex flex-row max-w-full h-full">
    <ScrollPanel
      class="overflow-hidden no-drag"
      :pt:content="{
        class: 'p-0 w-full',
        onwheel: handleWheel
      }"
      pt:barX="h-1"
    >
      <SelectButton
        class="workflow-tabs bg-transparent"
        :class="props.class"
        :modelValue="selectedTab"
        @update:modelValue="onTabChange"
        :options="tabs"
        optionLabel="label"
        dataKey="id"
      >
        <template #option="{ option }">
          <WorkflowTab
            v-if="isWorkflowTab(option)"
            :tab="option"
            @close="closeTab(option)"
            @contextmenu="showContextMenu($event, option)"
            @middle-click="closeTab(option)"
            @reorder="handleReorder"
          />
          <MenuPaneTab
            v-else
            :tab="option"
            @close="closeTab(option)"
            @contextmenu="showContextMenu($event, option)"
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
import type { MenuItem } from 'primevue/menuitem'
import ScrollPanel from 'primevue/scrollpanel'
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuPaneTab from '@/components/topbar/MenuPaneTab.vue'
import WorkflowTab from '@/components/topbar/WorkflowTab.vue'
import { useWorkflowService } from '@/services/workflowService'
import { useCommandStore } from '@/stores/commandStore'
import { useMenuPaneStore } from '@/stores/menuPaneStore'
import { useWorkflowBookmarkStore } from '@/stores/workflowStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import {
  BaseTabItem,
  MenuPaneTabItem,
  WorkflowTabItem,
  isMenuPaneTab,
  isWorkflowTab
} from '@/types/tabTypes'

const props = defineProps<{
  class?: string
}>()

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const workflowBookmarkStore = useWorkflowBookmarkStore()
const menuPaneStore = useMenuPaneStore()
const rightClickedTab = ref<BaseTabItem | null>(null)
const menu = ref()

const tabs = computed<BaseTabItem[]>(() => {
  const workflowTabs: WorkflowTabItem[] = workflowStore.openWorkflows.map(
    (workflow) => ({
      id: workflow.path,
      label: workflow.key,
      type: 'workflow',
      workflow
    })
  )

  const menuPaneTabs: MenuPaneTabItem[] = menuPaneStore.visiblePanes.map(
    (pane) => ({
      id: pane.path,
      label: pane.title,
      icon: pane.icon,
      type: 'menuPane',
      menuPaneId: pane.id
    })
  )

  return [...workflowTabs, ...menuPaneTabs]
})

const selectedTab = computed<BaseTabItem | null>(() => {
  if (menuPaneStore.activeMenuPane) {
    const pane = menuPaneStore.activeMenuPane
    return {
      id: pane.path,
      label: pane.title,
      icon: pane.icon,
      type: 'menuPane',
      menuPaneId: pane.id
    }
  }

  if (workflowStore.activeWorkflow) {
    const workflow = workflowStore.activeWorkflow
    return {
      id: workflow.path,
      label: workflow.key,
      type: 'workflow',
      workflow
    }
  }

  return null
})

const onTabChange = (tab: BaseTabItem) => {
  if (!tab) return
  if (selectedTab.value?.id === tab.id) return

  if (isMenuPaneTab(tab)) {
    menuPaneStore.setActiveMenuPane(tab.menuPaneId)
    if (workflowStore.activeWorkflow) workflowStore.activeWorkflow = null
    return
  }

  if (isWorkflowTab(tab)) {
    if (menuPaneStore.activeMenuPaneId) menuPaneStore.activeMenuPaneId = null
    workflowService.openWorkflow(tab.workflow)
  }
}

const closeTab = (tab: BaseTabItem) => {
  if (isMenuPaneTab(tab)) {
    menuPaneStore.hideMenuPane(tab.menuPaneId)
  } else if (isWorkflowTab(tab)) {
    closeTabs([tab])
  }
}

const closeTabs = async (tabsToClose: BaseTabItem[]) => {
  for (const tab of tabsToClose) {
    if (isMenuPaneTab(tab)) {
      menuPaneStore.hideMenuPane(tab.menuPaneId)
    } else if (isWorkflowTab(tab)) {
      if (
        !(await workflowService.closeWorkflow(tab.workflow, {
          warnIfUnsaved: !workspaceStore.shiftDown
        }))
      ) {
        // User clicked cancel
        break
      }
    }
  }
}

const showContextMenu = (event, tab: BaseTabItem) => {
  rightClickedTab.value = tab
  menu.value.show(event)
}

const contextMenuItems = computed<MenuItem[]>(() => {
  const tab = rightClickedTab.value
  if (!tab) return []

  const index = tabs.value.findIndex((t) => t.id === tab.id)

  // Base items for all tabs
  const menuItems: MenuItem[] = [
    {
      label: t('tabMenu.closeTab'),
      command: () => closeTab(tab)
    },
    {
      label: t('tabMenu.closeTabsToLeft'),
      command: () => closeTabs(tabs.value.slice(0, index)),
      disabled: index <= 0
    },
    {
      label: t('tabMenu.closeTabsToRight'),
      command: () => closeTabs(tabs.value.slice(index + 1)),
      disabled: index === tabs.value.length - 1
    },
    {
      label: t('tabMenu.closeOtherTabs'),
      command: () =>
        closeTabs([
          ...tabs.value.slice(0, index),
          ...tabs.value.slice(index + 1)
        ]),
      disabled: tabs.value.length <= 1
    }
  ]

  // Add workflow-specific options
  if (isWorkflowTab(tab)) {
    menuItems.unshift(
      {
        label: t('tabMenu.duplicateTab'),
        command: () => workflowService.duplicateWorkflow(tab.workflow)
      },
      { separator: true }
    )
    menuItems.push({
      label: workflowBookmarkStore.isBookmarked(tab.workflow.path)
        ? t('tabMenu.removeFromBookmarks')
        : t('tabMenu.addToBookmarks'),
      command: () => workflowBookmarkStore.toggleBookmarked(tab.workflow.path),
      disabled: tab.workflow.isTemporary
    })
  }

  return menuItems
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

const handleReorder = (fromTabId: string, toTabId: string) => {
  const fromIndex = tabs.value.findIndex((tab) => tab.id === fromTabId)
  const toIndex = tabs.value.findIndex((tab) => tab.id === toTabId)

  if (fromIndex !== -1 && toIndex !== -1) {
    if (
      isWorkflowTab(tabs.value[fromIndex]) &&
      isWorkflowTab(tabs.value[toIndex])
    ) {
      const fromWorkflowIndex = workflowStore.openWorkflows.findIndex(
        (wf) => wf.path === tabs.value[fromIndex].id
      )
      const toWorkflowIndex = workflowStore.openWorkflows.findIndex(
        (wf) => wf.path === tabs.value[toIndex].id
      )

      if (fromWorkflowIndex !== -1 && toWorkflowIndex !== -1) {
        workflowStore.reorderWorkflows(fromWorkflowIndex, toWorkflowIndex)
      }
    }
  }
}
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
:deep(.p-togglebutton:hover) .close-button,
.menu-pane-tab:hover .close-button {
  @apply visible;
}

:deep(.p-togglebutton:hover) .status-indicator {
  @apply hidden;
}

:deep(.p-togglebutton) .close-button,
.close-button {
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
