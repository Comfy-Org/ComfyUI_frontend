<template>
  <!-- Top menu bar needs to load before the GraphCanvas as it needs to host
  the menu buttons added by legacy extension scripts.-->
  <TopMenubar />
  <GraphCanvas />
  <GlobalToast />
  <UnloadWindowConfirmDialog />
  <BrowserTabTitle />
</template>

<script setup lang="ts">
import GraphCanvas from '@/components/graph/GraphCanvas.vue'

import { computed, onMounted, onBeforeUnmount, watch, watchEffect } from 'vue'
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
import GlobalToast from '@/components/toast/GlobalToast.vue'
import UnloadWindowConfirmDialog from '@/components/dialog/UnloadWindowConfirmDialog.vue'
import BrowserTabTitle from '@/components/BrowserTabTitle.vue'
import TopMenubar from '@/components/topbar/TopMenubar.vue'
import { setupAutoQueueHandler } from '@/services/autoQueueService'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useNodeLibrarySidebarTab } from '@/hooks/sidebarTabs/nodeLibrarySidebarTab'
import { useQueueSidebarTab } from '@/hooks/sidebarTabs/queueSidebarTab'
import { useModelLibrarySidebarTab } from '@/hooks/sidebarTabs/modelLibrarySidebarTab'
import { useWorkflowsSidebarTab } from '@/hooks/sidebarTabs/workflowsSidebarTab'

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
  useKeybindingStore().loadCoreKeybindings()

  const queueSidebarTab = useQueueSidebarTab()
  const nodeLibrarySidebarTab = useNodeLibrarySidebarTab()
  const modelLibrarySidebarTab = useModelLibrarySidebarTab()
  const workflowsSidebarTab = useWorkflowsSidebarTab()

  app.extensionManager = useWorkspaceStore()
  app.extensionManager.registerSidebarTab(queueSidebarTab)
  app.extensionManager.registerSidebarTab(nodeLibrarySidebarTab)
  app.extensionManager.registerSidebarTab(modelLibrarySidebarTab)
  app.extensionManager.registerSidebarTab(workflowsSidebarTab)
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
