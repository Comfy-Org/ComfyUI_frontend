import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import type { RenderOptions } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useBootstrapStore } from '@/stores/bootstrapStore'

import GraphCanvas from './GraphCanvas.vue'

/**
 * GraphCanvas is the only place the first-run tour is wired into startup: it
 * feeds the startup outcome to `handleStartupOutcome`, and the URL workflow
 * results to `handleUrlWorkflow`. Both composables are unit-tested on their
 * own; this file covers the seam, so deleting either call from the startup
 * sequence fails a test instead of silently disconnecting the feature. It also
 * pins the order the deep-link loaders depend on: dialogs they open must land
 * on top of the overlays `handleStartupOutcome` establishes.
 */
const mocks = vi.hoisted(() => ({
  handleStartupOutcome: vi.fn(),
  handleUrlWorkflow: vi.fn(),
  initializeWorkflow: vi.fn(),
  loadTemplateFromUrlIfPresent: vi.fn(),
  loadSharedWorkflowFromUrlIfPresent: vi.fn(),
  runUrlActionLoaders: vi.fn(),
  workspaceStore: {
    spinner: false,
    focusMode: false,
    sidebarTab: { activeSidebarTab: null }
  }
}))

vi.mock(
  '@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry',
  () => ({
    useFirstRunEntry: () => ({
      gettingStartedVisible: { value: false },
      handleStartupOutcome: mocks.handleStartupOutcome,
      handleUrlWorkflow: mocks.handleUrlWorkflow,
      dismissGettingStarted: vi.fn()
    })
  })
)

vi.mock(
  '@/platform/workflow/persistence/composables/useWorkflowPersistenceV2',
  () => ({
    useWorkflowPersistenceV2: () => ({
      initializeWorkflow: mocks.initializeWorkflow,
      restoreWorkflowTabsState: vi.fn(),
      loadTemplateFromUrlIfPresent: mocks.loadTemplateFromUrlIfPresent,
      loadSharedWorkflowFromUrlIfPresent:
        mocks.loadSharedWorkflowFromUrlIfPresent
    })
  })
)

vi.mock('@/scripts/app', () => {
  const canvas = {
    render_canvas_border: false,
    graph: null,
    onSelectionChange: null,
    setDirty: vi.fn(),
    canvas: document.createElement('canvas')
  }
  return {
    app: {
      vueAppReady: false,
      canvas,
      graph: null,
      rootGraph: null,
      ui: { settings: { dispatchChange: vi.fn() } },
      setup: vi.fn()
    }
  }
})

vi.mock('@/scripts/changeTracker', () => ({
  ChangeTracker: { init: vi.fn() }
}))

vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({
    initializeIfNewUser: vi.fn(),
    isNewUser: () => false
  })
}))

vi.mock('@/composables/useUrlActionLoaders', () => ({
  useUrlActionLoaders: () => ({
    runUrlActionLoaders: mocks.runUrlActionLoaders
  })
}))

vi.mock('@/platform/updates/common/releaseStore', () => ({
  useReleaseStore: () => ({ initialize: vi.fn() })
}))

vi.mock('@/composables/graph/useVueNodeLifecycle', () => ({
  useVueNodeLifecycle: () => ({
    nodeManager: { value: null },
    setupEmptyGraphListener: vi.fn(),
    initializeNodeManager: vi.fn(),
    disposeNodeManagerAndSyncs: vi.fn(),
    cleanup: vi.fn()
  })
}))

vi.mock('@/composables/graph/useErrorClearingHooks', () => ({
  installErrorClearingHooks: () => vi.fn()
}))

vi.mock('@/services/colorPaletteService', () => ({
  useColorPaletteService: () => ({ loadColorPalette: vi.fn() })
}))

vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({ forwardEventToCanvas: vi.fn() })
}))

vi.mock('@/composables/useCanvasDrop', () => ({ useCanvasDrop: vi.fn() }))
vi.mock('@/platform/settings/composables/useLitegraphSettings', () => ({
  useLitegraphSettings: vi.fn()
}))
vi.mock('@/composables/node/useNodeBadge', () => ({ useNodeBadge: vi.fn() }))
vi.mock('@/composables/useGlobalLitegraph', () => ({
  useGlobalLitegraph: vi.fn()
}))
vi.mock('@/composables/useContextMenuTranslation', () => ({
  useContextMenuTranslation: vi.fn()
}))
vi.mock('@/composables/graph/useGroupContextMenu', () => ({
  useGroupContextMenu: vi.fn()
}))
// Instantiating the real one pulls in the Firebase auth store.
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => mocks.workspaceStore
}))

vi.mock('@/composables/useCopy', () => ({ useCopy: vi.fn() }))
vi.mock('@/composables/usePaste', () => ({ usePaste: vi.fn() }))
vi.mock(
  '@/platform/workflow/persistence/composables/useWorkflowAutoSave',
  () => ({ useWorkflowAutoSave: vi.fn() })
)

async function mountGraphCanvas() {
  // Handed to the component rather than left to the active-Pinia fallback, so
  // the readiness gates below are set on the instance startup actually reads.
  const pinia = createTestingPinia({ stubActions: false })
  setActivePinia(pinia)

  // Startup waits on both readiness gates before it reaches the tour hand-off.
  useSettingStore().isReady = true
  useBootstrapStore().isI18nReady = true

  render(GraphCanvas, {
    // Child components are stubbed: this covers the startup sequence, not the
    // canvas chrome. `shallow` is forwarded verbatim to Vue Test Utils' mount,
    // which honours it — @testing-library/vue just omits it from its own type.
    shallow: true,
    global: {
      plugins: [
        pinia,
        createI18n({ legacy: false, locale: 'en', missingWarn: false })
      ]
    }
  } as RenderOptions<typeof GraphCanvas>)

  // The startup sequence is a chain of awaits; flush until it settles.
  for (let i = 0; i < 50; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

describe('GraphCanvas first-run tour wiring', () => {
  beforeEach(() => {
    // Startup writes to the workspace store, and clearAllMocks does not undo
    // writes to a plain object.
    Object.assign(mocks.workspaceStore, {
      spinner: false,
      focusMode: false,
      sidebarTab: { activeSidebarTab: null }
    })
    mocks.initializeWorkflow.mockResolvedValue('url-intent')
    mocks.loadTemplateFromUrlIfPresent.mockResolvedValue('image_to_image')
    mocks.loadSharedWorkflowFromUrlIfPresent.mockResolvedValue(undefined)
  })

  it('hands the startup outcome to the first-run entry point', async () => {
    await mountGraphCanvas()

    expect(mocks.handleStartupOutcome).toHaveBeenCalledWith('url-intent')
  })

  it('settles the startup outcome before running the URL action loaders', async () => {
    await mountGraphCanvas()

    expect(
      mocks.runUrlActionLoaders.mock.invocationCallOrder[0]
    ).toBeGreaterThan(mocks.handleStartupOutcome.mock.invocationCallOrder[0])
  })

  it('offers the tour over a workflow that arrived from the URL', async () => {
    await mountGraphCanvas()

    expect(mocks.handleUrlWorkflow).toHaveBeenCalledWith(
      'url-intent',
      'image_to_image',
      undefined
    )
  })
})
