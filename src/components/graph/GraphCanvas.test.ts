import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import type { RenderOptions } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useBootstrapStore } from '@/stores/bootstrapStore'
import { useExecutionStore } from '@/stores/executionStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

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
  setDirty: vi.fn(),
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
    setDirty: mocks.setDirty,
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
  if (app.canvas) app.canvas.graph = null

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

describe('GraphCanvas execution progress updates', () => {
  const totalNodes = 1_000
  const activeEntries = 500

  async function mountProgressHarness() {
    await mountGraphCanvas()

    let progressWrites = 0
    const progressValues: Array<number | undefined> = []
    const nodes = Array.from({ length: totalNodes }, (_, index) => {
      const node = new LGraphNode(`Test node ${index + 1}`)
      node.id = toNodeId(index + 1)
      let progress: number | undefined
      Object.defineProperty(node, 'progress', {
        get: () => progress,
        set: (value: number | undefined) => {
          progressWrites++
          progress = value
          progressValues[index] = value
        }
      })
      return node
    })

    const graph = new LGraph()
    graph._nodes.push(...nodes)

    const canvas = app.canvas
    if (!canvas) throw new Error('GraphCanvas did not initialize the canvas')
    canvas.graph = graph
    useCanvasStore().canvas = canvas

    const workflowStore = useWorkflowStore()
    vi.mocked(workflowStore.nodeToNodeLocatorId).mockImplementation((node) =>
      createNodeLocatorId(null, node.id)
    )

    const executionStore = useExecutionStore()
    const progressState = Object.fromEntries(
      Array.from({ length: activeEntries }, (_, index) => {
        const nodeId = String(index + 1)
        return [
          nodeId,
          {
            display_node_id: nodeId,
            node_id: nodeId,
            prompt_id: 'job',
            state: 'running' as const,
            value: 25,
            max: 100
          }
        ]
      })
    )

    executionStore.nodeProgressStates = progressState
    await nextTick()

    function resetObservedWork() {
      progressWrites = 0
      mocks.setDirty.mockClear()
      vi.mocked(workflowStore.nodeToNodeLocatorId).mockClear()
    }
    resetObservedWork()

    return {
      executionStore,
      workflowStore,
      progressState,
      progressValues,
      get progressWrites() {
        return progressWrites
      }
    }
  }

  it('does no graph work for structurally equal progress', async () => {
    const harness = await mountProgressHarness()

    harness.executionStore.nodeProgressStates = { ...harness.progressState }
    await nextTick()

    expect(harness.progressWrites).toBe(0)
    expect(mocks.setDirty).not.toHaveBeenCalled()
    expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
  })

  it('updates only the node whose progress changed', async () => {
    const harness = await mountProgressHarness()

    harness.executionStore.nodeProgressStates = {
      ...harness.progressState,
      '1': { ...harness.progressState['1'], value: 50 }
    }
    await nextTick()

    expect(harness.progressWrites).toBe(1)
    expect(harness.progressValues[0]).toBe(0.5)
    expect(mocks.setDirty).toHaveBeenCalledOnce()
    expect(mocks.setDirty).toHaveBeenCalledWith(true, false)
    expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
  })

  it('clears only the node whose progress was removed', async () => {
    const harness = await mountProgressHarness()
    const removedNodeId = String(activeEntries)
    const removedState = Object.fromEntries(
      Object.entries(harness.progressState).filter(
        ([nodeId]) => nodeId !== removedNodeId
      )
    )

    harness.executionStore.nodeProgressStates = removedState
    await nextTick()

    expect(harness.progressWrites).toBe(1)
    expect(harness.progressValues[activeEntries - 1]).toBeUndefined()
    expect(mocks.setDirty).toHaveBeenCalledOnce()
    expect(mocks.setDirty).toHaveBeenCalledWith(true, false)
    expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
  })

  it('ignores progress for a node outside the graph', async () => {
    const harness = await mountProgressHarness()
    const unmatchedNodeId = String(totalNodes + 1)

    harness.executionStore.nodeProgressStates = {
      ...harness.progressState,
      [unmatchedNodeId]: {
        display_node_id: unmatchedNodeId,
        node_id: unmatchedNodeId,
        prompt_id: 'job',
        state: 'running',
        value: 25,
        max: 100
      }
    }
    await nextTick()

    expect(harness.progressWrites).toBe(0)
    expect(mocks.setDirty).not.toHaveBeenCalled()
    expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
  })
})
