import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type * as VueUseCore from '@vueuse/core'
import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import type * as DistTypes from '@/platform/distribution/types'
import type * as I18nModule from '@/i18n'

const apiMock = vi.hoisted(() => new EventTarget())
const distribution = vi.hoisted(() => ({ isCloud: false }))

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
  return {
    ...actual,
    get isCloud() {
      return distribution.isCloud
    },
    isDesktop: false
  }
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
vi.mock('@/components/actionbar/PartnerNodesEducationCard.vue', () => ({
  default: { template: '<div data-testid="education-card-stub" />' }
}))
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
vi.mock('@/renderer/extensions/firstRunTour/FirstRunTour.vue', () => stubModule)

// Imported at module scope, not inside the test. `vi.mock` is hoisted above
// every import, so the stubs above still apply — but compiling GraphView.vue
// and its import graph costs seconds, and awaited inside a test body that is
// billed against the 5 s test timeout. That is what failed this test under a
// loaded worker pool while it passed in isolation (#14666).
const { default: GraphView } = await import('./GraphView.vue')

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('GraphView - reconnect wiring', () => {
  it('wires the reconnected event to the toast and queue refresh', () => {
    render(GraphView, { global: { plugins: [i18n] } })

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

describe('GraphView - partner nodes education card', () => {
  afterEach(() => {
    distribution.isCloud = false
  })

  it('mounts the card on local builds', () => {
    render(GraphView, { global: { plugins: [i18n] } })

    expect(screen.getByTestId('education-card-stub')).toBeInTheDocument()
  })

  it('never mounts the card on cloud', () => {
    distribution.isCloud = true

    render(GraphView, { global: { plugins: [i18n] } })

    expect(screen.queryByTestId('education-card-stub')).not.toBeInTheDocument()
  })
})
