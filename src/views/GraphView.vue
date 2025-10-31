<template>
  <div class="comfyui-body grid h-full w-full overflow-hidden">
    <div id="comfyui-body-top" class="comfyui-body-top" />
    <div id="comfyui-body-bottom" class="comfyui-body-bottom" />
    <div id="comfyui-body-left" class="comfyui-body-left" />
    <div id="comfyui-body-right" class="comfyui-body-right" />
    <div
      id="graph-canvas-container"
      ref="graphCanvasContainerRef"
      class="graph-canvas-container"
    >
      <GraphCanvas @ready="onGraphReady" />
    </div>
  </div>

  <GlobalToast />
  <RerouteMigrationToast />
  <VueNodesMigrationToast />
  <UnloadWindowConfirmDialog v-if="!isElectron()" />
  <MenuHamburger />
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchEffect
} from 'vue'
import { useI18n } from 'vue-i18n'

import { runWhenGlobalIdle } from '@/base/common/async'
import MenuHamburger from '@/components/MenuHamburger.vue'
import UnloadWindowConfirmDialog from '@/components/dialog/UnloadWindowConfirmDialog.vue'
import GraphCanvas from '@/components/graph/GraphCanvas.vue'
import GlobalToast from '@/components/toast/GlobalToast.vue'
import RerouteMigrationToast from '@/components/toast/RerouteMigrationToast.vue'
import VueNodesMigrationToast from '@/components/toast/VueNodesMigrationToast.vue'
import { useBrowserTabTitle } from '@/composables/useBrowserTabTitle'
import { useCoreCommands } from '@/composables/useCoreCommands'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useProgressFavicon } from '@/composables/useProgressFavicon'
import { SERVER_CONFIG_ITEMS } from '@/constants/serverConfig'
import { i18n, loadLocale } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useFrontendVersionMismatchWarning } from '@/platform/updates/common/useFrontendVersionMismatchWarning'
import { useVersionCompatibilityStore } from '@/platform/updates/common/versionCompatibilityStore'
import type { StatusWsMessageStatus } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { setupAutoQueueHandler } from '@/services/autoQueueService'
import { useKeybindingService } from '@/services/keybindingService'
import { useAssetsStore } from '@/stores/assetsStore'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useModelStore } from '@/stores/modelStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import {
  useQueuePendingTaskCountStore,
  useQueueStore
} from '@/stores/queueStore'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { electronAPI, isElectron } from '@/utils/envUtil'

setupAutoQueueHandler()
useProgressFavicon()
useBrowserTabTitle()

const { t } = useI18n()
const toast = useToast()
const settingStore = useSettingStore()
const executionStore = useExecutionStore()
const colorPaletteStore = useColorPaletteStore()
const queueStore = useQueueStore()
const assetsStore = useAssetsStore()
const versionCompatibilityStore = useVersionCompatibilityStore()
const graphCanvasContainerRef = ref<HTMLDivElement | null>(null)

const telemetry = useTelemetry()
const firebaseAuthStore = useFirebaseAuthStore()
let hasTrackedLogin = false
let visibilityListener: (() => void) | null = null
let tabCountInterval: number | null = null
let tabCountChannel: BroadcastChannel | null = null

watch(
  () => colorPaletteStore.completedActivePalette,
  (newTheme) => {
    const DARK_THEME_CLASS = 'dark-theme'
    if (newTheme.light_theme) {
      document.body.classList.remove(DARK_THEME_CLASS)
    } else {
      document.body.classList.add(DARK_THEME_CLASS)
    }

    if (isElectron()) {
      electronAPI().changeTheme({
        color: 'rgba(0, 0, 0, 0)',
        symbolColor: newTheme.colors.comfy_base['input-text']
      })
    }
  },
  { immediate: true }
)

if (isElectron()) {
  watch(
    () => queueStore.tasks,
    (newTasks, oldTasks) => {
      // Report tasks that previously running but are now completed (i.e. in history)
      const oldRunningTaskIds = new Set(
        oldTasks.filter((task) => task.isRunning).map((task) => task.promptId)
      )
      newTasks
        .filter(
          (task) => oldRunningTaskIds.has(task.promptId) && task.isHistory
        )
        .forEach((task) => {
          electronAPI().Events.incrementUserProperty(
            `execution:${task.displayStatus.toLowerCase()}`,
            1
          )
          electronAPI().Events.trackEvent('execution', {
            status: task.displayStatus.toLowerCase()
          })
        })
    },
    { deep: true }
  )
}

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

watchEffect(async () => {
  const locale = settingStore.get('Comfy.Locale')
  if (locale) {
    // Load the locale dynamically if not already loaded
    try {
      await loadLocale(locale)
      // Type assertion is safe here as loadLocale validates the locale exists
      i18n.global.locale.value = locale as typeof i18n.global.locale.value
    } catch (error) {
      console.error(`Failed to switch to locale "${locale}":`, error)
    }
  }
})

const useNewMenu = computed(() => {
  return settingStore.get('Comfy.UseNewMenu')
})
watchEffect(() => {
  if (useNewMenu.value === 'Disabled') {
    app.ui.menuContainer.style.setProperty('display', 'block')
    app.ui.restoreMenuPosition()
  } else {
    app.ui.menuContainer.style.setProperty('display', 'none')
  }
})

watchEffect(() => {
  queueStore.maxHistoryItems = settingStore.get('Comfy.Queue.MaxHistoryItems')
})

const init = () => {
  const coreCommands = useCoreCommands()
  useCommandStore().registerCommands(coreCommands)
  useMenuItemStore().registerCoreMenuCommands()
  useKeybindingService().registerCoreKeybindings()
  useSidebarTabStore().registerCoreSidebarTabs()
  useBottomPanelStore().registerCoreBottomPanelTabs()
  app.extensionManager = useWorkspaceStore()
}

const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
const onStatus = async (e: CustomEvent<StatusWsMessageStatus>) => {
  queuePendingTaskCountStore.update(e)
  await Promise.all([
    queueStore.update(),
    assetsStore.updateHistory() // Update history assets when status changes
  ])
}

const onExecutionSuccess = async () => {
  await Promise.all([
    queueStore.update(),
    assetsStore.updateHistory() // Update history assets on execution success
  ])
}

const reconnectingMessage: ToastMessageOptions = {
  severity: 'error',
  summary: t('g.reconnecting')
}

const onReconnecting = () => {
  if (!settingStore.get('Comfy.Toast.DisableReconnectingToast')) {
    toast.remove(reconnectingMessage)
    toast.add(reconnectingMessage)
  }
}

const onReconnected = () => {
  if (!settingStore.get('Comfy.Toast.DisableReconnectingToast')) {
    toast.remove(reconnectingMessage)
    toast.add({
      severity: 'success',
      summary: t('g.reconnected'),
      life: 2000
    })
  }
}

onMounted(() => {
  api.addEventListener('status', onStatus)
  api.addEventListener('execution_success', onExecutionSuccess)
  api.addEventListener('reconnecting', onReconnecting)
  api.addEventListener('reconnected', onReconnected)
  executionStore.bindExecutionEvents()

  try {
    init()
    // Relocate the legacy menu container to the graph canvas container so it is below other elements
    graphCanvasContainerRef.value?.prepend(app.ui.menuContainer)
  } catch (e) {
    console.error('Failed to init ComfyUI frontend', e)
  }
})

onBeforeUnmount(() => {
  api.removeEventListener('status', onStatus)
  api.removeEventListener('execution_success', onExecutionSuccess)
  api.removeEventListener('reconnecting', onReconnecting)
  api.removeEventListener('reconnected', onReconnected)
  executionStore.unbindExecutionEvents()

  // Clean up page visibility listener
  if (visibilityListener) {
    document.removeEventListener('visibilitychange', visibilityListener)
    visibilityListener = null
  }

  // Clean up tab count tracking
  if (tabCountInterval) {
    window.clearInterval(tabCountInterval)
    tabCountInterval = null
  }
  if (tabCountChannel) {
    tabCountChannel.close()
    tabCountChannel = null
  }
})

useEventListener(window, 'keydown', useKeybindingService().keybindHandler)

const { wrapWithErrorHandling, wrapWithErrorHandlingAsync } = useErrorHandling()

// Initialize version mismatch warning in setup context
// It will be triggered automatically when the store is ready
useFrontendVersionMismatchWarning({ immediate: true })

void nextTick(() => {
  versionCompatibilityStore.initialize().catch((error) => {
    console.warn('Version compatibility check failed:', error)
  })
})

const onGraphReady = () => {
  runWhenGlobalIdle(() => {
    // Track user login when app is ready in graph view (cloud only)
    if (isCloud && firebaseAuthStore.isAuthenticated && !hasTrackedLogin) {
      telemetry?.trackUserLoggedIn()
      hasTrackedLogin = true
    }

    // Set up page visibility tracking (cloud only)
    if (isCloud && telemetry && !visibilityListener) {
      visibilityListener = () => {
        telemetry.trackPageVisibilityChanged({
          visibility_state: document.visibilityState as 'visible' | 'hidden'
        })
      }
      document.addEventListener('visibilitychange', visibilityListener)
    }

    // Set up tab count tracking (cloud only)
    if (isCloud && telemetry && !tabCountInterval) {
      tabCountChannel = new BroadcastChannel('comfyui-tab-count')
      const activeTabs = new Map<string, number>()
      const currentTabId = crypto.randomUUID()

      // Listen for heartbeats from other tabs
      tabCountChannel.onmessage = (event) => {
        if (
          event.data.type === 'heartbeat' &&
          event.data.tabId !== currentTabId
        ) {
          activeTabs.set(event.data.tabId, Date.now())
        }
      }

      // 30-second heartbeat interval
      tabCountInterval = window.setInterval(() => {
        const now = Date.now()

        // Clean up stale tabs (no heartbeat for 45 seconds)
        activeTabs.forEach((lastHeartbeat, tabId) => {
          if (now - lastHeartbeat > 45000) {
            activeTabs.delete(tabId)
          }
        })

        // Broadcast our heartbeat
        tabCountChannel?.postMessage({ type: 'heartbeat', tabId: currentTabId })

        // Track tab count (include current tab)
        const tabCount = activeTabs.size + 1
        telemetry.trackTabCount({ tab_count: tabCount })
      }, 30000)

      // Send initial heartbeat
      tabCountChannel.postMessage({ type: 'heartbeat', tabId: currentTabId })
    }

    // Setting values now available after comfyApp.setup.
    // Load keybindings.
    wrapWithErrorHandling(useKeybindingService().registerUserKeybindings)()

    // Load server config
    wrapWithErrorHandling(useServerConfigStore().loadServerConfig)(
      SERVER_CONFIG_ITEMS,
      settingStore.get('Comfy.Server.ServerConfigValues')
    )

    // Load model folders
    void wrapWithErrorHandlingAsync(useModelStore().loadModelFolders)()

    // Non-blocking load of node frequencies
    void wrapWithErrorHandlingAsync(
      useNodeFrequencyStore().loadNodeFrequencies
    )()

    // Node defs now available after comfyApp.setup.
    // Explicitly initialize nodeSearchService to avoid indexing delay when
    // node search is triggered
    useNodeDefStore().nodeSearchService.searchNode('')
  }, 1000)
}
</script>

<style scoped>
.comfyui-body {
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr auto;
}

/**
  +------------------+------------------+------------------+
  |                                                        |
  |  .comfyui-body-                                        |
  |       top                                              |
  | (spans all cols)                                       |
  |                                                        |
  +------------------+------------------+------------------+
  |                  |                  |                  |
  | .comfyui-body-   |   #graph-canvas  | .comfyui-body-   |
  |      left        |                  |      right       |
  |                  |                  |                  |
  |                  |                  |                  |
  +------------------+------------------+------------------+
  |                                                        |
  |  .comfyui-body-                                        |
  |      bottom                                            |
  | (spans all cols)                                       |
  |                                                        |
  +------------------+------------------+------------------+
*/

.comfyui-body-top {
  order: -5;
  /* Span across all columns */
  grid-column: 1/-1;
  /* Position at the first row */
  grid-row: 1;
  /* Top menu bar dropdown needs to be above of graph canvas splitter overlay which is z-index: 999 */
  /* Top menu bar z-index needs to be higher than bottom menu bar z-index as by default
  pysssss's image feed is located at body-bottom, and it can overlap with the queue button, which
  is located in body-top. */
  z-index: 1001;
  display: flex;
  flex-direction: column;
}

.comfyui-body-left {
  order: -4;
  /* Position in the first column */
  grid-column: 1;
  /* Position below the top element */
  grid-row: 2;
  z-index: 10;
  display: flex;
}

.graph-canvas-container {
  width: 100%;
  height: 100%;
  order: -3;
  grid-column: 2;
  grid-row: 2;
  position: relative;
  overflow: clip;
}

.comfyui-body-right {
  order: -2;
  z-index: 10;
  grid-column: 3;
  grid-row: 2;
}

.comfyui-body-bottom {
  order: 4;
  /* Span across all columns */
  grid-column: 1/-1;
  grid-row: 3;
  /* Bottom menu bar dropdown needs to be above of graph canvas splitter overlay which is z-index: 999 */
  z-index: 1000;
  display: flex;
  flex-direction: column;
}
</style>
