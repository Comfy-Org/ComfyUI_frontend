import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type * as VueUseCore from '@vueuse/core'
import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import type * as DistTypes from '@/platform/distribution/types'
import type * as I18nModule from '@/i18n'

const apiMock = vi.hoisted(() => new EventTarget())

vi.mock('@/scripts/api', () => ({ api: apiMock }))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { getNodeById: vi.fn(), nodes: [] },
    ui: {
      menuContainer: { style: { setProperty: vi.fn() } },
      restoreMenuPosition: vi.fn()
    }
  }
}))

vi.mock('@/composables/useReconnectQueueRefresh', () => {
  const refreshOnReconnect = vi.fn(async () => {})
  return { useReconnectQueueRefresh: () => refreshOnReconnect }
})

vi.mock('@/composables/useReconnectingNotification', () => {
  const onReconnected = vi.fn()
  const onReconnecting = vi.fn()
  return {
    useReconnectingNotification: () => ({ onReconnected, onReconnecting })
  }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUseCore>()
  return { ...actual, useIntervalFn: vi.fn(() => ({ pause: vi.fn() })) }
})

vi.mock('@/base/common/async', () => ({ runWhenGlobalIdle: vi.fn() }))
vi.mock('@/composables/useBrowserTabTitle', () => ({
  useBrowserTabTitle: vi.fn()
}))
vi.mock('@/composables/useCoreCommands', () => ({ useCoreCommands: () => [] }))
vi.mock('@/platform/remote/comfyui/useQueuePolling', () => ({
  useQueuePolling: vi.fn()
}))
vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandling: (f: unknown) => f,
    wrapWithErrorHandlingAsync: (f: unknown) => f
  })
}))
vi.mock('@/composables/useProgressFavicon', () => ({
  useProgressFavicon: vi.fn()
}))
vi.mock('@/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof I18nModule>()
  return { ...actual, loadLocale: vi.fn().mockResolvedValue(undefined) }
})
vi.mock('@/platform/distribution/types', async (importOriginal) => {
  const actual = await importOriginal<typeof DistTypes>()
  return { ...actual, isCloud: false, isDesktop: false }
})
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: vi.fn(() => undefined), set: vi.fn() })
}))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))
vi.mock('@/platform/updates/common/useFrontendVersionMismatchWarning', () => ({
  useFrontendVersionMismatchWarning: vi.fn()
}))
vi.mock('@/platform/updates/common/versionCompatibilityStore', () => ({
  useVersionCompatibilityStore: () => ({
    initialize: vi.fn().mockResolvedValue(undefined)
  })
}))
vi.mock('@/renderer/core/canvas/canvasStore', async () => {
  const { defineStore } = await import('pinia')
  return {
    useCanvasStore: defineStore('canvas-test-stub', () => ({
      linearMode: ref(false)
    }))
  }
})
vi.mock('@/services/autoQueueService', () => ({
  setupAutoQueueHandler: vi.fn()
}))
vi.mock('@/platform/keybindings/keybindingService', () => ({
  useKeybindingService: () => ({
    registerCoreKeybindings: vi.fn(),
    keybindHandler: vi.fn()
  })
}))
vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ isBuilderMode: ref(false) })
}))
vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({ updateHistory: vi.fn() })
}))
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ registerCommands: vi.fn() })
}))
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    bindExecutionEvents: vi.fn(),
    unbindExecutionEvents: vi.fn(),
    activeJobId: null,
    clearActiveJobIfStale: vi.fn()
  })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: false })
}))
vi.mock('@/stores/menuItemStore', () => ({
  useMenuItemStore: () => ({ registerCoreMenuCommands: vi.fn() })
}))
vi.mock('@/stores/modelStore', () => ({ useModelStore: () => ({}) }))
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({}),
  useNodeFrequencyStore: () => ({})
}))
vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    update: vi.fn(),
    runningTasks: [],
    pendingTasks: [],
    tasks: [],
    maxHistoryItems: 64
  }),
  useQueuePendingTaskCountStore: () => ({ update: vi.fn() })
}))
vi.mock('@/stores/serverConfigStore', () => ({
  useServerConfigStore: () => ({})
}))
vi.mock('@/stores/workspace/bottomPanelStore', () => ({
  useBottomPanelStore: () => ({
    registerCoreBottomPanelTabs: vi.fn().mockResolvedValue(undefined)
  })
}))
vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: { light_theme: true, colors: { comfy_base: {} } }
  })
}))
vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => ({
    registerCoreSidebarTabs: vi.fn(),
    activeSidebarTabId: null
  })
}))
vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({
    changeTheme: vi.fn(),
    Events: { incrementUserProperty: vi.fn(), trackEvent: vi.fn() }
  })
}))

// Module-mock heavy child components so we don't pay their import cost.
const stubModule = { default: { template: '<div />' } }
vi.mock('@/components/graph/GraphCanvas.vue', () => stubModule)
vi.mock('@/views/LinearView.vue', () => stubModule)
vi.mock('@/components/builder/BuilderToolbar.vue', () => stubModule)
vi.mock('@/components/builder/BuilderMenu.vue', () => stubModule)
vi.mock('@/components/builder/BuilderFooterToolbar.vue', () => stubModule)
vi.mock(
  '@/workbench/extensions/manager/components/ManagerProgressToast.vue',
  () => stubModule
)
vi.mock(
  '@/platform/cloud/notification/components/DesktopCloudNotificationController.vue',
  () => stubModule
)
vi.mock(
  '@/platform/assets/components/ModelImportProgressDialog.vue',
  () => stubModule
)
vi.mock(
  '@/platform/assets/components/AssetExportProgressDialog.vue',
  () => stubModule
)
vi.mock(
  '@/platform/workspace/components/toasts/InviteAcceptedToast.vue',
  () => stubModule
)
vi.mock('@/components/toast/GlobalToast.vue', () => stubModule)
vi.mock('@/components/toast/RerouteMigrationToast.vue', () => stubModule)
vi.mock('@/components/MenuHamburger.vue', () => stubModule)
vi.mock('@/components/dialog/UnloadWindowConfirmDialog.vue', () => stubModule)

describe('GraphView - reconnect wiring', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('wires the reconnected event to the toast and queue refresh', async () => {
    const GraphView = (await import('./GraphView.vue')).default
    render(GraphView)

    apiMock.dispatchEvent(new Event('reconnected'))

    const { onReconnected } = useReconnectingNotification()
    const refreshOnReconnect = useReconnectQueueRefresh()
    await vi.waitFor(() => {
      expect(onReconnected).toHaveBeenCalledTimes(1)
      expect(refreshOnReconnect).toHaveBeenCalledTimes(1)
    })
  })
})
