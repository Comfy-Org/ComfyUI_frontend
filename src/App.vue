<template>
  <router-view />
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <BlockUI full-screen :blocked="isLoading" />
  <GlobalDialog />
  <GlobalToast />
  <UnloadWindowConfirmDialog />
  <BrowserTabTitle />
  <AppMenu />
</template>

<script setup lang="ts">
import {
  computed,
  markRaw,
  onMounted,
  onUnmounted,
  watch,
  watchEffect
} from 'vue'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import QueueSidebarTab from '@/components/sidebar/tabs/QueueSidebarTab.vue'
import AppMenu from '@/components/appMenu/AppMenu.vue'
import { app } from './scripts/app'
import { useSettingStore } from './stores/settingStore'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from './stores/workspaceStateStore'
import NodeLibrarySidebarTab from './components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import WorkflowsSidebarTab from './components/sidebar/tabs/WorkflowsSidebarTab.vue'
import GlobalDialog from './components/dialog/GlobalDialog.vue'
import GlobalToast from './components/toast/GlobalToast.vue'
import UnloadWindowConfirmDialog from './components/dialog/UnloadWindowConfirmDialog.vue'
import BrowserTabTitle from './components/BrowserTabTitle.vue'
import { api } from './scripts/api'
import { StatusWsMessageStatus } from './types/apiTypes'
import { useQueuePendingTaskCountStore } from './stores/queueStore'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { setupAutoQueueHandler } from './services/autoQueueService'
import { i18n } from './i18n'
import { useExecutionStore } from './stores/executionStore'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from './stores/workflowStore'

const isLoading = computed<boolean>(() => useWorkspaceStore().spinner)
const theme = computed<string>(() =>
  useSettingStore().get('Comfy.ColorPalette')
)
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

setupAutoQueueHandler()

watchEffect(() => {
  const fontSize = useSettingStore().get('Comfy.TextareaWidget.FontSize')
  document.documentElement.style.setProperty(
    '--comfy-textarea-font-size',
    `${fontSize}px`
  )
})

watchEffect(() => {
  const padding = useSettingStore().get('Comfy.TreeExplorer.ItemPadding')
  document.documentElement.style.setProperty(
    '--comfy-tree-explorer-item-padding',
    `${padding}px`
  )
})

watchEffect(() => {
  const locale = useSettingStore().get('Comfy.Locale')
  if (locale) {
    i18n.global.locale.value = locale
  }
})

const { t } = useI18n()
const init = () => {
  useSettingStore().addSettings(app.ui.settings)
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
    id: 'workflows',
    icon: 'pi pi-folder-open',
    iconBadge: () => {
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
const onStatus = (e: CustomEvent<StatusWsMessageStatus>) =>
  queuePendingTaskCountStore.update(e)

const toast = useToast()
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

const executionStore = useExecutionStore()
app.workflowManager.executionStore = executionStore
const workflowStore = useWorkflowStore()
app.workflowManager.workflowStore = workflowStore
const workflowBookmarkStore = useWorkflowBookmarkStore()
app.workflowManager.workflowBookmarkStore = workflowBookmarkStore

onMounted(() => {
  api.addEventListener('status', onStatus)
  api.addEventListener('reconnecting', onReconnecting)
  api.addEventListener('reconnected', onReconnected)
  executionStore.bindExecutionEvents()
  try {
    init()
  } catch (e) {
    console.error('Failed to init Vue app', e)
  }
})

onUnmounted(() => {
  api.removeEventListener('status', onStatus)
  api.removeEventListener('reconnecting', onReconnecting)
  api.removeEventListener('reconnected', onReconnected)
  executionStore.unbindExecutionEvents()
})
</script>

<style>
.p-tree-node-content {
  padding: var(--comfy-tree-explorer-item-padding) !important;
}
</style>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
