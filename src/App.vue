<template>
  <router-view />
  <ProgressSpinner
    v-if="isLoading"
    class="absolute inset-0 flex justify-center items-center h-screen"
  />
  <BlockUI full-screen :blocked="isLoading" />
  <GlobalDialog />
  <GlobalToast />
  <UnloadWindowConfirmDialog />
  <BrowserTabTitle />
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
import config from '@/config'
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
import { useWorkflowStore } from '@/stores/workflowStore'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import QueueSidebarTab from '@/components/sidebar/tabs/QueueSidebarTab.vue'
import NodeLibrarySidebarTab from '@/components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import GlobalToast from '@/components/toast/GlobalToast.vue'
import UnloadWindowConfirmDialog from '@/components/dialog/UnloadWindowConfirmDialog.vue'
import BrowserTabTitle from '@/components/BrowserTabTitle.vue'

const isLoading = computed<boolean>(() => useWorkspaceStore().spinner)

const { t } = useI18n()
const toast = useToast()
const settingStore = useSettingStore()
const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
const executionStore = useExecutionStore()
const workflowStore = useWorkflowStore()

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
}

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

app.workflowManager.executionStore = executionStore
watchEffect(() => {
  app.menu.workflows.buttonProgress.style.width = `${executionStore.executionProgress}%`
})
app.workflowManager.workflowStore = workflowStore

onMounted(() => {
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version
  console.log('ComfyUI Front-end version:', config.app_version)

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

onUnmounted(() => {
  api.removeEventListener('status', onStatus)
  api.removeEventListener('reconnecting', onReconnecting)
  api.removeEventListener('reconnected', onReconnected)
  executionStore.unbindExecutionEvents()
})
</script>
