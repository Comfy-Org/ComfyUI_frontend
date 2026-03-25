import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import GraphView from '@/views/GraphView.vue'

const linearMode = ref(false)
const isBuilderMode = ref(false)

const workspaceTheme = reactive({
  light_theme: true,
  colors: {
    comfy_base: {
      'input-text': '#000000'
    }
  }
})

const queueStore = reactive({
  tasks: [],
  maxHistoryItems: 0,
  update: vi.fn().mockResolvedValue(undefined)
})

const sidebarTabStore = reactive({
  activeSidebarTabId: null as string | null,
  registerCoreSidebarTabs: vi.fn()
})

const settingValues = reactive({
  shown: false
})

const settingStore = {
  load: vi.fn<() => Promise<void>>(),
  get: vi.fn((key: string) => {
    switch (key) {
      case 'Comfy.Desktop.CloudNotificationShown':
        return settingValues.shown
      case 'Comfy.TextareaWidget.FontSize':
        return 12
      case 'Comfy.TreeExplorer.ItemPadding':
        return 8
      case 'Comfy.Locale':
        return 'en'
      case 'Comfy.UseNewMenu':
        return 'Enabled'
      case 'Comfy.Queue.MaxHistoryItems':
        return 100
      case 'Comfy.Toast.DisableReconnectingToast':
        return false
      case 'Comfy.Server.ServerConfigValues':
        return {}
      default:
        return undefined
    }
  }),
  set: vi.fn(async (_key: string, value: boolean) => {
    settingValues.shown = value
  })
}

const dialogService = {
  showCloudNotification: vi.fn<() => Promise<void>>()
}

const executionStore = {
  bindExecutionEvents: vi.fn(),
  unbindExecutionEvents: vi.fn()
}

const versionCompatibilityStore = {
  initialize: vi.fn().mockResolvedValue(undefined)
}

const colorPaletteStore = reactive({
  completedActivePalette: workspaceTheme
})

const electron = {
  changeTheme: vi.fn(),
  showContextMenu: vi.fn(),
  getPlatform: vi.fn(() => 'darwin'),
  Events: {
    incrementUserProperty: vi.fn(),
    trackEvent: vi.fn()
  }
}

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useEventListener: vi.fn(),
    useIntervalFn: vi.fn()
  }
})

vi.mock('pinia', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    storeToRefs: (store: object) => store
  }
})

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
    remove: vi.fn()
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/base/common/async', () => ({
  runWhenGlobalIdle: (cb: () => void) => cb()
}))

vi.mock('@/components/MenuHamburger.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/components/builder/BuilderFooterToolbar.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/components/builder/BuilderMenu.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/components/builder/BuilderToolbar.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/components/dialog/UnloadWindowConfirmDialog.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/components/graph/GraphCanvas.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/components/toast/GlobalToast.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/components/toast/RerouteMigrationToast.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isBuilderMode
  })
}))

vi.mock('@/composables/useBrowserTabTitle', () => ({
  useBrowserTabTitle: vi.fn()
}))

vi.mock('@/composables/useCoreCommands', () => ({
  useCoreCommands: vi.fn(() => ({}))
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandling: (fn: (...args: unknown[]) => unknown) => fn,
    wrapWithErrorHandlingAsync: (
      fn: (...args: unknown[]) => Promise<unknown>
    ) => fn
  })
}))

vi.mock('@/composables/useProgressFavicon', () => ({
  useProgressFavicon: vi.fn()
}))

vi.mock('@/constants/serverConfig', () => ({
  SERVER_CONFIG_ITEMS: []
}))

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      locale: {
        value: 'en'
      }
    }
  },
  loadLocale: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: true
}))

vi.mock('@/platform/assets/components/AssetExportProgressDialog.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/platform/assets/components/ModelImportProgressDialog.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/platform/keybindings/keybindingService', () => ({
  useKeybindingService: () => ({
    registerCoreKeybindings: vi.fn(),
    registerUserKeybindings: vi.fn(),
    keybindHandler: vi.fn()
  })
}))

vi.mock('@/platform/remote/comfyui/useQueuePolling', () => ({
  useQueuePolling: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settingStore
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn()
}))

vi.mock('@/platform/updates/common/useFrontendVersionMismatchWarning', () => ({
  useFrontendVersionMismatchWarning: vi.fn()
}))

vi.mock('@/platform/updates/common/versionCompatibilityStore', () => ({
  useVersionCompatibilityStore: () => versionCompatibilityStore
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    linearMode
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {}
}))

vi.mock('@/scripts/app', () => ({
  app: {
    ui: {
      menuContainer: document.createElement('div'),
      restoreMenuPosition: vi.fn()
    }
  }
}))

vi.mock('@/services/autoQueueService', () => ({
  setupAutoQueueHandler: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => dialogService
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    updateHistory: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    registerCommands: vi.fn()
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => executionStore
}))

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: () => ({
    isAuthenticated: false
  })
}))

vi.mock('@/stores/menuItemStore', () => ({
  useMenuItemStore: () => ({
    registerCoreMenuCommands: vi.fn()
  })
}))

vi.mock('@/stores/modelStore', () => ({
  useModelStore: () => ({
    loadModelFolders: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeSearchService: {
      searchNode: vi.fn()
    }
  }),
  useNodeFrequencyStore: () => ({
    loadNodeFrequencies: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/queueStore', () => ({
  useQueuePendingTaskCountStore: () => ({
    update: vi.fn()
  }),
  useQueueStore: () => queueStore
}))

vi.mock('@/stores/serverConfigStore', () => ({
  useServerConfigStore: () => ({
    loadServerConfig: vi.fn()
  })
}))

vi.mock('@/stores/workspace/bottomPanelStore', () => ({
  useBottomPanelStore: () => ({
    registerCoreBottomPanelTabs: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => colorPaletteStore
}))

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => sidebarTabStore
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => electron
}))

vi.mock('@/views/LinearView.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock(
  '@/platform/workspace/components/toasts/InviteAcceptedToast.vue',
  () => ({
    default: {
      template: '<div />'
    }
  })
)

vi.mock(
  '@/workbench/extensions/manager/components/ManagerProgressToast.vue',
  () => ({
    default: {
      template: '<div />'
    }
  })
)

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe('GraphView cloud notification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    linearMode.value = false
    isBuilderMode.value = false
    sidebarTabStore.activeSidebarTabId = null
    settingValues.shown = false
    electron.getPlatform.mockReturnValue('darwin')

    settingStore.load.mockResolvedValue(undefined)
    settingStore.set.mockImplementation(
      async (_key: string, value: boolean) => {
        settingValues.shown = value
      }
    )
    dialogService.showCloudNotification.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mountGraphView() {
    return shallowMount(GraphView)
  }

  it('waits for settings to load before deciding whether to show the notification', async () => {
    const loadSettings = createDeferred()
    settingStore.load.mockImplementation(() => loadSettings.promise)

    const wrapper = mountGraphView()
    await nextTick()

    settingValues.shown = true
    loadSettings.resolve()

    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('marks the notification as shown before awaiting dialog close', async () => {
    const dialogOpen = createDeferred()
    dialogService.showCloudNotification.mockImplementation(
      () => dialogOpen.promise
    )

    const wrapper = mountGraphView()

    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(settingStore.set).toHaveBeenCalledWith(
      'Comfy.Desktop.CloudNotificationShown',
      true
    )
    expect(settingStore.set.mock.invocationCallOrder[0]).toBeLessThan(
      dialogService.showCloudNotification.mock.invocationCallOrder[0]
    )

    dialogOpen.resolve()
    await flushPromises()

    wrapper.unmount()
  })
})
