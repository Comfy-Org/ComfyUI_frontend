import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import type { RenderOptions } from '@testing-library/vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { useWorkflowPersistenceV2 } from '@/platform/workflow/persistence/composables/useWorkflowPersistenceV2'
import type { StartupOutcome } from '@/platform/workflow/persistence/base/draftTypes'
import { useBootstrapStore } from '@/stores/bootstrapStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import GraphCanvas from './GraphCanvas.vue'
const agentDocked = { value: true }
vi.mock<unknown>(
  import('@/workbench/extensions/agent/composables/useAgentDockMount'),
  async () => {
    const { computed, defineComponent, h } = await import('vue')
    return {
      useAgentDockMount: () => ({
        docked: computed(() => agentDocked.value),
        DockedAgentPanel: defineComponent({
          name: 'DockedAgentPanel',
          setup: () => () => h('div')
        })
      })
    }
  }
)

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry/reportError'))

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
  handleStartupOutcome: vi.fn(async () => undefined),
  handleUrlWorkflow: vi.fn(async () => undefined),
  initializeWorkflow: vi.fn(async (): Promise<StartupOutcome> => 'url-intent'),
  restoreWorkflowTabsState: vi.fn(async () => undefined),
  loadTemplateFromUrlIfPresent: vi.fn(
    async (): Promise<string | undefined> => undefined
  ),
  loadSharedWorkflowFromUrlIfPresent: vi.fn<
    ReturnType<
      typeof useWorkflowPersistenceV2
    >['loadSharedWorkflowFromUrlIfPresent']
  >(async () => 'not-present'),
  runUrlActionLoaders: vi.fn(async (): Promise<void> => undefined),
  setDirty: vi.fn()
}))

vi.mock<unknown>(
  import('@/renderer/extensions/firstRunTour/gettingStarted/firstRunEntry'),
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
  import('@/platform/workflow/persistence/composables/useWorkflowPersistenceV2'),
  () => ({
    useWorkflowPersistenceV2: () => ({
      initializeWorkflow: mocks.initializeWorkflow,
      restoreWorkflowTabsState: mocks.restoreWorkflowTabsState,
      loadTemplateFromUrlIfPresent: mocks.loadTemplateFromUrlIfPresent,
      loadSharedWorkflowFromUrlIfPresent:
        mocks.loadSharedWorkflowFromUrlIfPresent
    })
  })
)

vi.mock<unknown>(import('@/scripts/app'), () => {
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

vi.mock<unknown>(import('@/scripts/changeTracker'), () => ({
  ChangeTracker: { init: vi.fn() }
}))

vi.mock<unknown>(import('@/services/useNewUserService'), () => ({
  useNewUserService: () => ({
    initializeIfNewUser: vi.fn(),
    isNewUser: () => false
  })
}))

vi.mock(import('@/composables/useUrlActionLoaders'), () => ({
  useUrlActionLoaders: () => ({
    runUrlActionLoaders: mocks.runUrlActionLoaders
  })
}))

vi.mock(import('@/composables/graph/useErrorClearingHooks'), () => ({
  installErrorClearingHooks: () => vi.fn()
}))

vi.mock<unknown>(import('@/services/colorPaletteService'), () => ({
  useColorPaletteService: () => ({ loadColorPalette: vi.fn() })
}))

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))

vi.mock(import('@/composables/useCanvasDrop'), () => ({
  useCanvasDrop: vi.fn()
}))
vi.mock(import('@/platform/settings/composables/useLitegraphSettings'), () => ({
  useLitegraphSettings: vi.fn()
}))
vi.mock(import('@/composables/node/useNodeBadge'), () => ({
  useNodeBadge: vi.fn()
}))
vi.mock(import('@/composables/useGlobalLitegraph'), () => ({
  useGlobalLitegraph: vi.fn()
}))
vi.mock(import('@/composables/useContextMenuTranslation'), () => ({
  useContextMenuTranslation: vi.fn()
}))
vi.mock(import('@/composables/graph/useGroupContextMenu'), () => ({
  useGroupContextMenu: vi.fn()
}))

vi.mock(import('@/composables/useCopy'), () => ({ useCopy: vi.fn() }))
vi.mock(import('@/composables/usePaste'), () => ({ usePaste: vi.fn() }))
vi.mock(
  import('@/platform/workflow/persistence/composables/useWorkflowAutoSave'),
  () => ({ useWorkflowAutoSave: vi.fn() })
)

async function mountGraphCanvas(stubs: Record<string, unknown> = {}) {
  // Handed to the component rather than left to the active-Pinia fallback, so
  // the readiness gates below are set on the instance startup actually reads.
  const pinia = getActivePinia()!
  vi.spyOn(api, 'getSystemStats').mockResolvedValue(
    fromPartial<Awaited<ReturnType<typeof api.getSystemStats>>>({})
  )
  vi.mocked(useReleaseStore().initialize).mockResolvedValue(undefined)
  app.canvas.graph = null

  // Startup waits on both readiness gates before it reaches the tour hand-off.
  useSettingStore().isReady = true
  useBootstrapStore().isI18nReady = true

  const view = render(GraphCanvas, {
    // Child components are stubbed: this covers the startup sequence, not the
    // canvas chrome. `shallow` is forwarded verbatim to Vue Test Utils' mount,
    // which honours it — @testing-library/vue just omits it from its own type.
    shallow: true,
    global: {
      plugins: [
        pinia,
        createI18n({ legacy: false, locale: 'en', missingWarn: false })
      ],
      stubs
    }
  } as RenderOptions<typeof GraphCanvas>)

  // The startup sequence is a chain of awaits; flush until it settles.
  for (let i = 0; i < 50; i++) {
    await nextTick()
    await Promise.resolve()
  }
  return view
}

describe('GraphCanvas first-run tour wiring', () => {
  beforeEach(() => {
    mocks.initializeWorkflow.mockResolvedValue('url-intent')
    mocks.loadTemplateFromUrlIfPresent.mockResolvedValue('image_to_image')
    mocks.loadSharedWorkflowFromUrlIfPresent.mockResolvedValue('not-present')
  })

  it.for([
    'Failed to fetch dynamically imported module: https://example.com/core.js',
    'Importing a module script failed.',
    'error loading dynamically imported module'
  ])('offers reload guidance and stops startup for %s', async (message) => {
    const error = new TypeError(message)
    vi.mocked(app.setup).mockRejectedValueOnce(error)

    const { emitted } = await mountGraphCanvas()

    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'g.preloadErrorTitle',
        detail: 'g.preloadError'
      })
    )
    expect(useWorkspaceStore().spinner).toBe(false)
    expect(useCanvasStore().canvas).toBeNull()
    expect(emitted('ready')).toBeUndefined()
    expect(mocks.initializeWorkflow).not.toHaveBeenCalled()
    expect(mocks.handleStartupOutcome).not.toHaveBeenCalled()
    expect(mocks.runUrlActionLoaders).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'failure_initializing_graph_canvas',
      surface: 'graph'
    })
  })

  it('shows the actual setup error instead of resource reload guidance', async () => {
    const error = new Error('Graph initialization failed')
    vi.mocked(app.setup).mockRejectedValueOnce(error)

    const { emitted } = await mountGraphCanvas()

    expect(emitted('ready')).toBeUndefined()
    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'g.error',
        detail: 'Graph initialization failed'
      })
    )
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'failure_initializing_graph_canvas',
      surface: 'graph'
    })
  })

  it.for([
    ['workflow initialization', mocks.initializeWorkflow],
    ['tab restoration', mocks.restoreWorkflowTabsState],
    ['template loading', mocks.loadTemplateFromUrlIfPresent],
    ['startup tour', mocks.handleStartupOutcome],
    ['shared workflow loading', mocks.loadSharedWorkflowFromUrlIfPresent],
    ['URL actions', mocks.runUrlActionLoaders]
  ] as const)(
    'keeps a functional canvas ready when %s fails',
    async ([, task]) => {
      const complete = vi.spyOn(bootstrapTracer, 'complete')
      const error = new Error('Startup data unavailable')
      task.mockRejectedValueOnce(error)

      const { emitted } = await mountGraphCanvas()

      expect(emitted('ready')).toHaveLength(1)
      expect(complete).toHaveBeenCalledWith(
        task === mocks.loadSharedWorkflowFromUrlIfPresent ||
          task === mocks.runUrlActionLoaders
          ? 'completed'
          : 'failed'
      )
      expect(useCanvasStore().canvas).toBe(app.canvas)
      expect(useWorkspaceStore().spinner).toBe(false)
      expect(reportError).toHaveBeenCalledWith(error, {
        errorType: 'failure_initializing_graph_canvas',
        surface: 'graph'
      })
      expect(mocks.restoreWorkflowTabsState).toHaveBeenCalledOnce()
      expect(mocks.loadTemplateFromUrlIfPresent).toHaveBeenCalledOnce()
      if (task === mocks.initializeWorkflow) {
        expect(mocks.handleStartupOutcome).not.toHaveBeenCalled()
      } else {
        expect(mocks.handleStartupOutcome).toHaveBeenCalledWith('url-intent')
      }
      expect(mocks.runUrlActionLoaders).toHaveBeenCalledOnce()
      expect(useReleaseStore().initialize).toHaveBeenCalledOnce()
    }
  )

  it('reports malformed backend addresses without losing functional readiness', async () => {
    const error = new Error('Unable to contact http://host:99999')
    mocks.restoreWorkflowTabsState.mockRejectedValueOnce(error)

    const { emitted } = await mountGraphCanvas()

    expect(emitted('ready')).toHaveLength(1)
    expect(mocks.loadTemplateFromUrlIfPresent).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'failure_initializing_graph_canvas',
      surface: 'graph'
    })
    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'g.error', detail: error.message })
    )
  })

  it('finishes bootstrap when loading ends even while a URL dialog remains open', async () => {
    const complete = vi.spyOn(bootstrapTracer, 'complete')
    let closeDialog!: () => void
    const dialog = new Promise<void>((resolve) => {
      closeDialog = resolve
    })
    onTestFinished(() => {
      closeDialog()
    })
    mocks.runUrlActionLoaders.mockReturnValueOnce(dialog)

    const { emitted } = await mountGraphCanvas()

    expect(useWorkspaceStore().spinner).toBe(false)
    expect(complete).toHaveBeenCalledOnce()
    expect(complete).toHaveBeenCalledWith('completed')
    expect(emitted('ready')).toBeUndefined()
    closeDialog()
    for (let i = 0; i < 50; i++) {
      await nextTick()
      await Promise.resolve()
    }
    expect(emitted('ready')).toHaveLength(1)
  })

  it('reports a release lookup failure without blocking readiness', async () => {
    const error = new Error('Release service unavailable')
    vi.mocked(useReleaseStore().initialize).mockRejectedValueOnce(error)

    const { emitted } = await mountGraphCanvas()

    expect(emitted('ready')).toHaveLength(1)
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'failure_initializing_graph_canvas',
      surface: 'graph'
    })
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
      'not-present'
    )
  })
})

describe('GraphCanvas execution progress updates', () => {
  async function mountProgressHarness({
    totalNodes = 1_000,
    activeEntries = 500
  }: {
    totalNodes?: number
    activeEntries?: number
  } = {}) {
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
      totalNodes,
      activeEntries,
      get progressWrites() {
        return progressWrites
      }
    }
  }

  it.for([
    { totalNodes: 1, activeEntries: 0 },
    { totalNodes: 1, activeEntries: 1 },
    { totalNodes: 8, activeEntries: 8 },
    { totalNodes: 1_000, activeEntries: 500 }
  ])(
    'pins equal-state fanout for $totalNodes nodes and $activeEntries active entries',
    async ({ totalNodes, activeEntries }) => {
      const harness = await mountProgressHarness({ totalNodes, activeEntries })

      harness.executionStore.nodeProgressStates = Object.fromEntries(
        Object.entries(harness.progressState).map(([nodeId, progress]) => [
          nodeId,
          { ...progress }
        ])
      )
      await nextTick()

      expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
      expect(harness.progressWrites).toBe(0)
      expect(mocks.setDirty).not.toHaveBeenCalled()
    }
  )

  it.for([
    { totalNodes: 1, activeEntries: 1 },
    { totalNodes: 8, activeEntries: 8 },
    { totalNodes: 1_000, activeEntries: 500 }
  ])(
    'pins single-change fanout for $totalNodes nodes and $activeEntries active entries',
    async ({ totalNodes, activeEntries }) => {
      const harness = await mountProgressHarness({ totalNodes, activeEntries })
      const clonedProgressState = Object.fromEntries(
        Object.entries(harness.progressState).map(([nodeId, progress]) => [
          nodeId,
          { ...progress }
        ])
      )

      harness.executionStore.nodeProgressStates = {
        ...clonedProgressState,
        '1': { ...clonedProgressState['1'], value: 50 }
      }
      await nextTick()

      expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
      expect(harness.progressWrites).toBe(1)
      expect(harness.progressValues[0]).toBe(0.5)
      expect(mocks.setDirty).toHaveBeenCalledOnce()
    }
  )

  it('clears stale progress when an execution entry is removed', async () => {
    const harness = await mountProgressHarness({
      totalNodes: 1,
      activeEntries: 1
    })

    harness.executionStore.nodeProgressStates = {}
    await nextTick()

    expect(harness.progressWrites).toBe(1)
    expect(harness.progressValues[0]).toBeUndefined()
    expect(mocks.setDirty).toHaveBeenCalledOnce()
    expect(mocks.setDirty).toHaveBeenCalledWith(true, false)
  })

  it('clears stale progress when the current graph changes', async () => {
    await mountProgressHarness({ totalNodes: 1, activeEntries: 1 })
    const replacementNode = new LGraphNode('Replacement node')
    replacementNode.id = toNodeId(2)
    replacementNode.progress = 0.75
    const replacementGraph = new LGraph()
    replacementGraph._nodes.push(replacementNode)

    const canvas = app.canvas
    canvas.graph = replacementGraph
    useCanvasStore().currentGraph = replacementGraph
    await nextTick()

    expect(replacementNode.progress).toBeUndefined()
    expect(mocks.setDirty).toHaveBeenCalledOnce()
    expect(mocks.setDirty).toHaveBeenCalledWith(true, false)
  })

  it('does no graph work for structurally equal progress', async () => {
    const harness = await mountProgressHarness()

    harness.executionStore.nodeProgressStates = Object.fromEntries(
      Object.entries(harness.progressState).map(([nodeId, progress]) => [
        nodeId,
        { ...progress }
      ])
    )
    await nextTick()

    expect(harness.progressWrites).toBe(0)
    expect(mocks.setDirty).not.toHaveBeenCalled()
    expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
  })

  it('updates only the node whose progress changed', async () => {
    const harness = await mountProgressHarness()

    const clonedProgressState = Object.fromEntries(
      Object.entries(harness.progressState).map(([nodeId, progress]) => [
        nodeId,
        { ...progress }
      ])
    )
    harness.executionStore.nodeProgressStates = {
      ...clonedProgressState,
      '1': { ...clonedProgressState['1'], value: 50 }
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
    const removedNodeId = String(harness.activeEntries)
    const removedState = Object.fromEntries(
      Object.entries(harness.progressState).filter(
        ([nodeId]) => nodeId !== removedNodeId
      )
    )

    harness.executionStore.nodeProgressStates = removedState
    await nextTick()

    expect(harness.progressWrites).toBe(1)
    expect(harness.progressValues[harness.activeEntries - 1]).toBeUndefined()
    expect(mocks.setDirty).toHaveBeenCalledOnce()
    expect(mocks.setDirty).toHaveBeenCalledWith(true, false)
    expect(harness.workflowStore.nodeToNodeLocatorId).not.toHaveBeenCalled()
  })

  it('ignores progress for a node outside the graph', async () => {
    const harness = await mountProgressHarness()
    const unmatchedNodeId = String(harness.totalNodes + 1)

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

describe('GraphCanvas agent dock', () => {
  // The dock is slot content of the splitter overlay, so the overlay stub has
  // to render that slot for the guard to be observable.
  const dockStubs = {
    LiteGraphCanvasSplitterOverlay: {
      template: '<div><slot name="agent-panel" /></div>'
    },
    DockedAgentPanel: { template: '<div data-testid="docked-agent-panel" />' }
  }

  it('mounts the dock in graph mode', async () => {
    useCanvasStore().linearMode = false
    await mountGraphCanvas(dockStubs)

    expect(screen.getByTestId('docked-agent-panel')).toBeInTheDocument()
  })

  it('leaves the dock to LinearView in linear mode', async () => {
    useCanvasStore().linearMode = true
    await mountGraphCanvas(dockStubs)

    expect(screen.queryByTestId('docked-agent-panel')).not.toBeInTheDocument()
  })
})
