import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type * as VueUseCore from '@vueuse/core'
import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import type * as DistTypes from '@/platform/distribution/types'
import type * as I18nModule from '@/i18n'

const apiMock = vi.hoisted(() => new EventTarget())

vi.mock<unknown>(import('@/scripts/api'), () => ({ api: apiMock }))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    rootGraph: { getNodeById: vi.fn(), nodes: [] },
    ui: {
      menuContainer: { style: { setProperty: vi.fn() } },
      restoreMenuPosition: vi.fn()
    }
  }
}))

vi.mock(import('@/composables/useReconnectQueueRefresh'), () => {
  const refreshOnReconnect = vi.fn(async () => {})
  return { useReconnectQueueRefresh: () => refreshOnReconnect }
})

vi.mock(import('@/composables/useReconnectingNotification'), () => {
  const onReconnected = vi.fn()
  const onReconnecting = vi.fn()
  return {
    useReconnectingNotification: () => ({ onReconnected, onReconnecting })
  }
})

vi.mock<unknown>(import('@vueuse/core'), async (importOriginal) => {
  const actual = await importOriginal<typeof VueUseCore>()
  return { ...actual, useIntervalFn: vi.fn(() => ({ pause: vi.fn() })) }
})

vi.mock(import('@/base/common/async'), () => ({ runWhenGlobalIdle: vi.fn() }))
vi.mock(import('@/composables/useBrowserTabTitle'), () => ({
  useBrowserTabTitle: vi.fn()
}))
vi.mock(import('@/composables/useCoreCommands'), () => ({
  useCoreCommands: () => []
}))
vi.mock(import('@/platform/remote/comfyui/useQueuePolling'), () => ({
  useQueuePolling: vi.fn()
}))
vi.mock<unknown>(import('@/composables/useErrorHandling'), () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandling: (f: unknown) => f,
    wrapWithErrorHandlingAsync: (f: unknown) => f
  })
}))
vi.mock(import('@/composables/useProgressFavicon'), () => ({
  useProgressFavicon: vi.fn()
}))
vi.mock(import('@/i18n'), async (importOriginal) => {
  const actual = await importOriginal<typeof I18nModule>()
  return { ...actual, loadLocale: vi.fn().mockResolvedValue(undefined) }
})
vi.mock(import('@/platform/distribution/types'), async (importOriginal) => {
  const actual = await importOriginal<typeof DistTypes>()
  return { ...actual, isCloud: false, isDesktop: false }
})
vi.mock<unknown>(import('@/platform/settings/settingStore'), () => ({
  useSettingStore: () => ({ get: vi.fn(() => undefined), set: vi.fn() })
}))
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => undefined
}))
vi.mock(
  import('@/platform/updates/common/useFrontendVersionMismatchWarning'),
  () => ({
    useFrontendVersionMismatchWarning: vi.fn()
  })
)
vi.mock<unknown>(
  import('@/platform/updates/common/versionCompatibilityStore'),
  () => ({
    useVersionCompatibilityStore: () => ({
      initialize: vi.fn().mockResolvedValue(undefined)
    })
  })
)
vi.mock<unknown>(import('@/renderer/core/canvas/canvasStore'), async () => {
  const { defineStore } = await import('pinia')
  return {
    useCanvasStore: defineStore('canvas-test-stub', () => ({
      linearMode: ref(false)
    }))
  }
})
vi.mock(import('@/services/autoQueueService'), () => ({
  setupAutoQueueHandler: vi.fn()
}))
vi.mock<unknown>(import('@/platform/keybindings/keybindingService'), () => ({
  useKeybindingService: () => ({
    registerCoreKeybindings: vi.fn(),
    keybindHandler: vi.fn()
  })
}))
vi.mock<unknown>(import('@/composables/useAppMode'), () => ({
  useAppMode: () => ({ isBuilderMode: ref(false) })
}))
vi.mock<unknown>(import('@/stores/assetsStore'), () => ({
  useAssetsStore: () => ({ updateHistory: vi.fn() })
}))
vi.mock<unknown>(import('@/stores/commandStore'), () => ({
  useCommandStore: () => ({ registerCommands: vi.fn() })
}))
vi.mock<unknown>(import('@/stores/executionStore'), () => ({
  useExecutionStore: () => ({
    bindExecutionEvents: vi.fn(),
    unbindExecutionEvents: vi.fn(),
    activeJobId: null,
    clearActiveJobIfStale: vi.fn()
  })
}))
vi.mock<unknown>(import('@/stores/authStore'), () => ({
  useAuthStore: () => ({ isAuthenticated: false })
}))
vi.mock<unknown>(import('@/stores/menuItemStore'), () => ({
  useMenuItemStore: () => ({ registerCoreMenuCommands: vi.fn() })
}))
vi.mock<unknown>(import('@/stores/modelStore'), () => ({
  useModelStore: () => ({})
}))
vi.mock<unknown>(import('@/stores/nodeDefStore'), () => ({
  useNodeDefStore: () => ({}),
  useNodeFrequencyStore: () => ({})
}))
vi.mock<unknown>(import('@/stores/queueStore'), () => ({
  useQueueStore: () => ({
    update: vi.fn(),
    runningTasks: [],
    pendingTasks: [],
    tasks: [],
    maxHistoryItems: 64
  }),
  useQueuePendingTaskCountStore: () => ({ update: vi.fn() })
}))
vi.mock<unknown>(import('@/stores/serverConfigStore'), () => ({
  useServerConfigStore: () => ({})
}))
vi.mock<unknown>(import('@/stores/workspace/bottomPanelStore'), () => ({
  useBottomPanelStore: () => ({
    registerCoreBottomPanelTabs: vi.fn().mockResolvedValue(undefined)
  })
}))
vi.mock<unknown>(import('@/stores/workspace/colorPaletteStore'), () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: { light_theme: true, colors: { comfy_base: {} } }
  })
}))
vi.mock<unknown>(import('@/stores/workspace/sidebarTabStore'), () => ({
  useSidebarTabStore: () => ({
    registerCoreSidebarTabs: vi.fn(),
    activeSidebarTabId: null
  })
}))
vi.mock<unknown>(import('@/utils/envUtil'), () => ({
  electronAPI: () => ({
    changeTheme: vi.fn(),
    Events: { incrementUserProperty: vi.fn(), trackEvent: vi.fn() }
  })
}))

// Module-mock heavy child components so we don't pay their import cost.
const stubModule = { default: { template: '<div />' } }
vi.mock<unknown>(import('@/components/graph/GraphCanvas.vue'), () => stubModule)
vi.mock<unknown>(import('@/views/LinearView.vue'), () => stubModule)
vi.mock<unknown>(
  import('@/components/builder/BuilderToolbar.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/components/builder/BuilderMenu.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/components/builder/BuilderFooterToolbar.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/workbench/extensions/manager/components/ManagerProgressToast.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/platform/cloud/notification/components/DesktopCloudNotificationController.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/platform/assets/components/ModelImportProgressDialog.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/platform/assets/components/AssetExportProgressDialog.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/platform/workspace/components/toasts/InviteAcceptedToast.vue'),
  () => stubModule
)
vi.mock<unknown>(import('@/components/toast/GlobalToast.vue'), () => stubModule)
vi.mock<unknown>(
  import('@/components/toast/RerouteMigrationToast.vue'),
  () => stubModule
)
vi.mock<unknown>(import('@/components/MenuHamburger.vue'), () => stubModule)
vi.mock<unknown>(
  import('@/components/dialog/UnloadWindowConfirmDialog.vue'),
  () => stubModule
)
vi.mock<unknown>(
  import('@/renderer/extensions/firstRunTour/FirstRunTour.vue'),
  () => stubModule
)

// Imported at module scope, not inside the test. `vi.mock` is hoisted above
// every import, so the stubs above still apply — but compiling GraphView.vue
// and its import graph costs seconds, and awaited inside a test body that is
// billed against the 5 s test timeout. That is what failed this test under a
// loaded worker pool while it passed in isolation (#14666).
const { default: GraphView } = await import('./GraphView.vue')

describe('GraphView - reconnect wiring', () => {
  it('wires the reconnected event to the toast and queue refresh', () => {
    render(GraphView)

    apiMock.dispatchEvent(new Event('reconnected'))

    // `handleReconnected` calls both before its first `await`, so dispatching
    // the event is enough — there is nothing to wait for, and waiting for it
    // only hid how long the import above was taking.
    const { onReconnected } = useReconnectingNotification()
    const refreshOnReconnect = useReconnectQueueRefresh()
    expect(onReconnected).toHaveBeenCalledTimes(1)
    expect(refreshOnReconnect).toHaveBeenCalledTimes(1)
  })
})
