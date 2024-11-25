<template>
  <!-- Top menu bar needs to load before the GraphCanvas as it needs to host
  the menu buttons added by legacy extension scripts.-->
  <TopMenubar />
  <GraphCanvas @ready="onGraphReady" />
  <GlobalToast />
  <UnloadWindowConfirmDialog />
  <BrowserTabTitle />
  <MenuHamburger />
</template>

<script setup lang="ts">
import GraphCanvas from '@/components/graph/GraphCanvas.vue'
import MenuHamburger from '@/components/MenuHamburger.vue'
import { computed, onMounted, onBeforeUnmount, watch, watchEffect } from 'vue'
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { api } from '@/scripts/api'
import { StatusWsMessageStatus } from '@/types/apiTypes'
import {
  useQueuePendingTaskCountStore,
  useQueueStore
} from '@/stores/queueStore'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { i18n } from '@/i18n'
import { useExecutionStore } from '@/stores/executionStore'
import GlobalToast from '@/components/toast/GlobalToast.vue'
import UnloadWindowConfirmDialog from '@/components/dialog/UnloadWindowConfirmDialog.vue'
import BrowserTabTitle from '@/components/BrowserTabTitle.vue'
import TopMenubar from '@/components/topbar/TopMenubar.vue'
import { setupAutoQueueHandler } from '@/services/autoQueueService'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useModelStore } from '@/stores/modelStore'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { SERVER_CONFIG_ITEMS } from '@/constants/serverConfig'

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

watchEffect(() => {
  useQueueStore().maxHistoryItems = settingStore.get(
    'Comfy.Queue.MaxHistoryItems'
  )
})

const init = () => {
  settingStore.addSettings(app.ui.settings)
  useKeybindingStore().loadCoreKeybindings()
  useSidebarTabStore().registerCoreSidebarTabs()
  useBottomPanelStore().registerCoreBottomPanelTabs()
  app.extensionManager = useWorkspaceStore()
}

const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
const queueStore = useQueueStore()
const onStatus = async (e: CustomEvent<StatusWsMessageStatus>) => {
  queuePendingTaskCountStore.update(e)
  await queueStore.update()
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

const onGraphReady = () => {
  requestIdleCallback(
    () => {
      // Setting values now available after comfyApp.setup.
      // Load keybindings.
      useKeybindingStore().loadUserKeybindings()

      // Load server config
      useServerConfigStore().loadServerConfig(
        SERVER_CONFIG_ITEMS,
        settingStore.get('Comfy.Server.ServerConfigValues')
      )

      // Load model folders
      useModelStore().loadModelFolders()

      // Migrate legacy bookmarks
      useNodeBookmarkStore().migrateLegacyBookmarks()

      // Node defs now available after comfyApp.setup.
      // Explicitly initialize nodeSearchService to avoid indexing delay when
      // node search is triggered
      useNodeDefStore().nodeSearchService.endsWithFilterStartSequence('')

      // Non-blocking load of node frequencies
      useNodeFrequencyStore().loadNodeFrequencies()
    },
    { timeout: 1000 }
  )
}
</script>
