<template>
  <GraphCanvas />
  <GlobalToast />
  <UnloadWindowConfirmDialog />
  <BrowserTabTitle />
  <AppMenu />
</template>

<script setup lang="ts">
import GraphCanvas from '@/components/graph/GraphCanvas.vue'

import {
  computed,
  markRaw,
  onMounted,
  onBeforeUnmount,
  watch,
  watchEffect
} from 'vue'
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import { api } from '@/scripts/api'
import { StatusWsMessageStatus } from '@/types/apiTypes'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { i18n } from '@/i18n'
import { useExecutionStore } from '@/stores/executionStore'
import {
  useWorkflowStore,
  useWorkflowBookmarkStore
} from '@/stores/workflowStore'
import QueueSidebarTab from '@/components/sidebar/tabs/QueueSidebarTab.vue'
import NodeLibrarySidebarTab from '@/components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import ModelLibrarySidebarTab from '@/components/sidebar/tabs/ModelLibrarySidebarTab.vue'
import GlobalToast from '@/components/toast/GlobalToast.vue'
import UnloadWindowConfirmDialog from '@/components/dialog/UnloadWindowConfirmDialog.vue'
import BrowserTabTitle from '@/components/BrowserTabTitle.vue'
import AppMenu from '@/components/appMenu/AppMenu.vue'
import WorkflowsSidebarTab from '@/components/sidebar/tabs/WorkflowsSidebarTab.vue'
import { setupAutoQueueHandler } from '@/services/autoQueueService'

setupAutoQueueHandler()

const { t } = useI18n()
const toast = useToast()
const settingStore = useSettingStore()
const executionStore = useExecutionStore()

const theme = computed<string>(() => settingStore.get('Comfy.ColorPalette'))

watch(
  theme,
  (newTheme) => {
    const DARK_THEME_CLASS = 'dark-theme'
    const isDarkTheme = newTheme !== 'light'
    if (isDarkTheme) {
      document.body.classList.add(DARK_THEME_CLASS)
    } else {
      document.body.classList.remove(DARK_THEME_CLASS)
    }
  },
  { immediate: true }
)

watchEffect(() => {
  const fontSize = settingStore.get('Comfy.TextareaWidget.FontSize')
  document.documentElement.style.setProperty(
    '--comfy-textarea-font-size',
    `${fontSize}px`
  )
})

watchEffect(() => {
  const padding = settingStore.get('Comfy.TreeExplorer.ItemPadding')
  document.documentElement.style.setProperty(
    '--comfy-tree-explorer-item-padding',
    `${padding}px`
  )
})

watchEffect(() => {
  const locale = settingStore.get('Comfy.Locale')
  if (locale) {
    i18n.global.locale.value = locale as 'en' | 'zh'
  }
})

watchEffect(() => {
  const useNewMenu = settingStore.get('Comfy.UseNewMenu')
  if (useNewMenu === 'Disabled') {
    app.ui.menuContainer.style.removeProperty('display')
    app.ui.restoreMenuPosition()
  } else {
    app.ui.menuContainer.style.setProperty('display', 'none')
  }
})

const init = () => {
  settingStore.addSettings(app.ui.settings)
  app.extensionManager = useWorkspaceStore()
  app.extensionManager.registerSidebarTab({
    id: 'queue',
    icon: 'pi pi-history',
    iconBadge: () => {
      const value = useQueuePendingTaskCountStore().count.toString()
      return value === '0' ? null : value
    },
    title: t('sideToolbar.queue'),
    tooltip: t('sideToolbar.queue'),
    component: markRaw(QueueSidebarTab),
    type: 'vue'
  })
  app.extensionManager.registerSidebarTab({
    id: 'node-library',
    icon: 'pi pi-book',
    title: t('sideToolbar.nodeLibrary'),
    tooltip: t('sideToolbar.nodeLibrary'),
    component: markRaw(NodeLibrarySidebarTab),
    type: 'vue'
  })
  app.extensionManager.registerSidebarTab({
    id: 'model-library',
    icon: 'pi pi-box',
    title: t('sideToolbar.modelLibrary'),
    tooltip: t('sideToolbar.modelLibrary'),
    component: markRaw(ModelLibrarySidebarTab),
    type: 'vue'
  })
  app.extensionManager.registerSidebarTab({
    id: 'workflows',
    icon: 'pi pi-folder-open',
    iconBadge: () => {
      if (
        settingStore.get('Comfy.Workflow.WorkflowTabsPosition') !== 'Sidebar'
      ) {
        return null
      }
      const value = useWorkflowStore().openWorkflows.length.toString()
      return value === '0' ? null : value
    },
    title: t('sideToolbar.workflows'),
    tooltip: t('sideToolbar.workflows'),
    component: markRaw(WorkflowsSidebarTab),
    type: 'vue'
  })
}

const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
const onStatus = (e: CustomEvent<StatusWsMessageStatus>) => {
  queuePendingTaskCountStore.update(e)
}

const reconnectingMessage: ToastMessageOptions = {
  severity: 'error',
  summary: t('reconnecting')
}

const onReconnecting = () => {
  toast.remove(reconnectingMessage)
  toast.add(reconnectingMessage)
}

const onReconnected = () => {
  toast.remove(reconnectingMessage)
  toast.add({
    severity: 'success',
    summary: t('reconnected'),
    life: 2000
  })
}

const workflowStore = useWorkflowStore()
const workflowBookmarkStore = useWorkflowBookmarkStore()
app.workflowManager.executionStore = executionStore
app.workflowManager.workflowStore = workflowStore
app.workflowManager.workflowBookmarkStore = workflowBookmarkStore

onMounted(() => {
  api.addEventListener('status', onStatus)
  api.addEventListener('reconnecting', onReconnecting)
  api.addEventListener('reconnected', onReconnected)
  executionStore.bindExecutionEvents()

  try {
    init()
  } catch (e) {
    console.error('Failed to init ComfyUI frontend', e)
  }
})

onBeforeUnmount(() => {
  api.removeEventListener('status', onStatus)
  api.removeEventListener('reconnecting', onReconnecting)
  api.removeEventListener('reconnected', onReconnected)
  executionStore.unbindExecutionEvents()
})
</script>
