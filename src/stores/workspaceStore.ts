import { useMagicKeys } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { Settings } from '@/platform/settings/types'
import { useColorPaletteService } from '@/services/colorPaletteService'
import type {
  SidebarTabExtension,
  ToastManager,
  ToastMessageOptions
} from '@/types/extensionTypes'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import { useApiKeyAuthStore } from './apiKeyAuthStore'
import { useCommandStore } from './commandStore'
import { useExecutionErrorStore } from './executionErrorStore'
import { useAuthStore } from './authStore'
import { useQueueSettingsStore } from './queueSettingsStore'
import { useBottomPanelStore } from './workspace/bottomPanelStore'
import { useSidebarTabStore } from './workspace/sidebarTabStore'

const legacySeverityKinds = new Map<
  string,
  'error' | 'info' | 'success' | 'warning'
>([
  ['contrast', 'info'],
  ['error', 'error'],
  ['info', 'info'],
  ['secondary', 'info'],
  ['success', 'success'],
  ['warn', 'warning'],
  ['warning', 'warning']
])

function workspaceStoreSetup() {
  const spinner = ref(false)
  const { shift: shiftDown } = useMagicKeys()
  const focusMode = ref(false)

  const toastStore = useToast()
  let reportedWarningSeverity = false
  function reportWarningSeverity() {
    if (reportedWarningSeverity) return
    reportedWarningSeverity = true
    reportError(new Error('toast.add received severity "warning"'), {
      surface: 'platform',
      errorType: 'deprecated_toast_warning_severity',
      level: 'warning'
    })
  }
  const toast: ToastManager = {
    add: (message: ToastMessageOptions) => {
      const severity: string = message.severity ?? 'info'
      if (severity === 'warning') reportWarningSeverity()
      const kind = legacySeverityKinds.get(severity)
      if (!kind) {
        console.error(`toast.add: unsupported severity "${severity}"`)
        return
      }
      toastStore[kind](message.summary ?? message.detail ?? '', {
        closable: message.closable,
        description: message.summary === undefined ? undefined : message.detail,
        duration: message.life || undefined
      })
    },
    addAlert: (message) => toastStore.warning(message),
    dismiss: toastStore.dismiss,
    dismissAll: toastStore.dismissAll,
    error: toastStore.error,
    info: toastStore.info,
    loading: toastStore.loading,
    success: toastStore.success,
    warning: toastStore.warning
  }
  const queueSettings = computed(() => useQueueSettingsStore())
  const command = computed(() => ({
    commands: useCommandStore().commands,
    execute: useCommandStore().execute
  }))
  const sidebarTab = computed(() => useSidebarTabStore())
  const setting = computed(() => ({
    settings: useSettingStore().settingsById,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
    get: <T = unknown>(key: string): T | undefined =>
      useSettingStore().get(key as keyof Settings) as T | undefined,
    set: (key: string, value: unknown) =>
      useSettingStore().set(
        key as keyof Settings,
        value as Settings[keyof Settings]
      )
  }))
  const workflow = computed(() => useWorkflowStore())
  const colorPalette = useColorPaletteService()
  const bottomPanel = useBottomPanelStore()

  const authStore = useAuthStore()
  const apiKeyStore = useApiKeyAuthStore()

  const isApiKeyLogin = computed(() => apiKeyStore.isAuthenticated)
  const isLoggedIn = computed(
    () => isApiKeyLogin.value || authStore.isAuthenticated
  )
  const partialUserStore = {
    isLoggedIn
  }

  function registerSidebarTab(tab: SidebarTabExtension) {
    sidebarTab.value.registerSidebarTab(tab)
  }

  function unregisterSidebarTab(id: string) {
    sidebarTab.value.unregisterSidebarTab(id)
  }

  function getSidebarTabs(): SidebarTabExtension[] {
    return sidebarTab.value.sidebarTabs
  }

  const executionErrorStore = useExecutionErrorStore()

  return {
    spinner,
    shiftDown,
    focusMode,
    toggleFocusMode: () => {
      focusMode.value = !focusMode.value
    },
    toast,
    queueSettings,
    command,
    sidebarTab,
    setting,
    workflow,
    colorPalette,
    bottomPanel,
    user: partialUserStore,

    lastNodeErrors: computed(() => executionErrorStore.lastNodeErrors),
    lastExecutionError: computed(() => executionErrorStore.lastExecutionError),

    registerSidebarTab,
    unregisterSidebarTab,
    getSidebarTabs,
    renderMarkdownToHtml
  }
}

export const useWorkspaceStore = defineStore('workspace', workspaceStoreSetup)
