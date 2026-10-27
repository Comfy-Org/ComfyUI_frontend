import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia } from 'pinia'
import { cleanup, fireEvent, render, screen } from '@testing-library/vue'
import type { RenderOptions } from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { Toast } from '@/components/ui/toast/toastStore'
import { IS_CONTROL_WIDGET } from '@/core/graph/widgets/controlWidgetMarker'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_LISTING_NO_HINT_WAIT_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import {
  hasDeploymentLink,
  readDeploymentHint
} from '@/platform/workspace/deploymentHint'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { api } from '@/scripts/api'
import { loadExtensions } from '@/services/extensionLoader'
import { app } from '@/scripts/app'
import { useBootstrapStore } from '@/stores/bootstrapStore'
import { useExecutionStore } from '@/stores/executionStore'
import { toNodeId } from '@/types/nodeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import GraphCanvas from './GraphCanvas.vue'
const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'localhost' as const,
  isDesktop: false,
  isNightly: false,
  get isCloud() {
    return distribution.isCloud
  }
}))
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

vi.mock(import('@/platform/workspace/deploymentHint'), () => ({
  readDeploymentHint: vi.fn<typeof readDeploymentHint>(() => 'deployment'),
  hasDeploymentLink: vi.fn(() => false),
  setDeploymentHint: vi.fn()
}))

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
      restoreWorkflowTabsState: vi.fn(),
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
  let rootGraphInternal: LGraph | undefined
  return {
    app: {
      vueAppReady: false,
      canvas,
      get graph(): LGraph {
        return rootGraphInternal!
      },
      get rootGraph(): LGraph {
        return rootGraphInternal!
      },
      get rootGraphOrUndefined(): LGraph | undefined {
        return rootGraphInternal
      },
      get isGraphReady(): boolean {
        return !!rootGraphInternal
      },
      set rootGraph(graph: LGraph | undefined) {
        rootGraphInternal = graph
      },
      ui: { settings: { dispatchChange: vi.fn() } },
      setup: vi.fn()
    }
  }
})

vi.mock<unknown>(import('@/scripts/changeTracker'), () => ({
  ChangeTracker: { init: vi.fn() }
}))

vi.mock(import('@/services/extensionLoader'), () => ({
  loadExtensions: vi.fn(async () => {})
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

/**
 * Installs (or clears) the mock app's root graph, standing in for the
 * assignment `ComfyApp.setup()` makes. The real class exposes no setter, so the
 * mock's test-only one is reached through a cast.
 */
function setRootGraph(graph: LGraph | undefined) {
  ;(app as unknown as { rootGraph: LGraph | undefined }).rootGraph = graph
}

async function mountGraphCanvas(stubs: Record<string, unknown> = {}) {
  // Handed to the component rather than left to the active-Pinia fallback, so
  // the readiness gates below are set on the instance startup actually reads.
  const pinia = getActivePinia()!
  vi.mocked(useReleaseStore().initialize).mockResolvedValue(undefined)
  app.canvas.graph = null
  setRootGraph(undefined)

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
      ],
      stubs
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

describe('GraphCanvas legacy settings bridge', () => {
  it('keeps title-editor touches within the canvas parent used by extensions', async () => {
    vi.spyOn(api, 'getSystemStats').mockResolvedValue(
      fromPartial({ devices: [] })
    )
    await mountGraphCanvas({
      TitleEditor: { template: '<input aria-label="Node title" />' }
    })
    // oxlint-disable-next-line testing-library/no-node-access -- Extensions use this canvas ID.
    const canvas = document.getElementById('graph-canvas')
    assert.exists(canvas)
    // oxlint-disable-next-line testing-library/no-node-access -- Canvas-parent listeners are the compatibility contract under test.
    const parent = canvas.parentElement
    assert.exists(parent)
    const receivedTouch = vi.fn()
    parent.addEventListener('touchstart', receivedTouch, true)
    onTestFinished(() =>
      parent.removeEventListener('touchstart', receivedTouch, true)
    )

    await fireEvent.touchStart(
      screen.getByRole('textbox', { name: 'Node title' })
    )

    expect(receivedTouch).toHaveBeenCalledOnce()
  })

  it('replays setting changes on the legacy settings dialog', async () => {
    await mountGraphCanvas()

    expect(app.ui.settings.dispatchChange).toHaveBeenCalledWith(
      'Comfy.Locale',
      expect.anything(),
      undefined
    )
  })

  it('stops replaying after unmount', async () => {
    await mountGraphCanvas()
    cleanup()
    vi.mocked(app.ui.settings.dispatchChange).mockClear()
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())

    await useSettingStore().set('Comfy.Locale', 'zh')

    expect(app.ui.settings.dispatchChange).not.toHaveBeenCalled()
  })
})

describe('GraphCanvas late custom nodes', () => {
  it('stops turning late custom nodes on once the canvas unmounts', async () => {
    await mountGraphCanvas()
    const [signal] = vi.mocked(loadExtensions).mock.calls[0]
    expect(signal?.aborted).toBe(false)

    cleanup()

    expect(signal?.aborted).toBe(true)
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
    expect(mocks.setDirty).toHaveBeenCalledWith(true, expect.anything())
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

describe('GraphCanvas widget control mode watcher', () => {
  async function cycleWidgetControlMode() {
    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.WidgetControlMode'] = 'before'
    await nextTick()
    settingStore.settingValues['Comfy.WidgetControlMode'] = 'after'
    await nextTick()
  }

  function addControlWidgetNode() {
    const controlWidget = {
      name: 'control_after_generate',
      label: undefined as string | undefined,
      [IS_CONTROL_WIDGET]: true
    }
    const node = new LGraphNode('Test node')
    node.id = toNodeId(1)
    node.widgets = [controlWidget as unknown as IBaseWidget]

    const graph = new LGraph()
    graph._nodes.push(node)

    return { graph, controlWidget }
  }

  // Defensive: the app only writes `canvasStore.canvas` after `setup()` has
  // installed the root graph, so this state is not reachable in production. The
  // guard keeps the watcher consistent with its siblings that read the graph.
  it('defensively skips the control-widget sync when the root graph is not ready', async () => {
    await mountGraphCanvas()

    useCanvasStore().canvas = app.canvas
    expect(app.rootGraphOrUndefined).toBeUndefined()

    await expect(cycleWidgetControlMode()).resolves.toBeUndefined()
  })

  it('still syncs control-widget labels once the root graph is ready', async () => {
    await mountGraphCanvas()

    useCanvasStore().canvas = app.canvas
    const { graph, controlWidget } = addControlWidgetNode()

    await expect(cycleWidgetControlMode()).resolves.toBeUndefined()
    expect(controlWidget.label).toBeUndefined()

    setRootGraph(graph)

    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.WidgetControlMode'] = 'before'
    await nextTick()
    const labelBeforeMode = controlWidget.label
    expect(labelBeforeMode).toBeTruthy()

    settingStore.settingValues['Comfy.WidgetControlMode'] = 'after'
    await nextTick()
    expect(controlWidget.label).toBeTruthy()
    expect(controlWidget.label).not.toBe(labelBeforeMode)
  })
})

describe('GraphCanvas selection watcher', () => {
  it('redraws the background when the selected nodes change', async () => {
    await mountGraphCanvas()
    const graph = new LGraph()
    const node = new LGraphNode('Test node')
    graph.add(node)
    useCanvasStore().canvas = app.canvas
    useCanvasStore().currentGraph = graph
    await nextTick()
    mocks.setDirty.mockClear()

    node.selected = true
    await nextTick()

    expect(mocks.setDirty).toHaveBeenCalledWith(expect.anything(), true)
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

describe('deployment model options at startup', () => {
  beforeEach(() => {
    // These tests pin startup against the deployment lookup's backstop to the
    // millisecond, so the fake clock must move only when a test moves it. With
    // the suite's `shouldAdvanceTime`, a real 20ms interval also ticks it, and
    // when that lands in the native yield after a timer fires mid-advance
    // (the bootstrap watchdog at 30s), `advanceTimersByTimeAsync` extends its
    // window by the same 20ms and runs the backstop early.
    vi.useFakeTimers({ shouldAdvanceTime: false })
    distribution.isCloud = true
    onTestFinished(() => {
      distribution.isCloud = false
    })
    vi.mocked(readDeploymentHint).mockReturnValue('deployment')
    vi.mocked(hasDeploymentLink).mockReturnValue(false)
  })

  it.for([
    { listing: 'never answers', answer: () => new Promise<void>(() => {}) },
    { listing: 'fails', answer: () => Promise.resolve() }
  ])(
    'mounts the canvas at once, with no lookup toast, when the listing $listing and this browser last booted on Comfy Cloud',
    async ({ answer }) => {
      vi.mocked(readDeploymentHint).mockReturnValue('cloud')
      const store = useDeploymentPickStore()
      vi.spyOn(store, 'loadOnce').mockReturnValue(answer())

      await mountGraphCanvas()

      expect(app.setup).toHaveBeenCalledOnce()
      expect(store.bootDeployment).toBeNull()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
      expect(getActivePinia()?.state.value.toast?.toasts ?? []).toEqual([])
    }
  )

  it.for([
    {
      why: 'the page opened from a deployment link, though this browser last booted on Comfy Cloud',
      hint: 'cloud' as const,
      link: true
    },
    {
      why: 'this browser last booted on a deployment',
      hint: 'deployment' as const,
      link: false
    }
  ])(
    'waits for the listing, then shows the lookup toast, when $why',
    async ({ hint, link }) => {
      vi.mocked(readDeploymentHint).mockReturnValue(hint)
      vi.mocked(hasDeploymentLink).mockReturnValue(link)
      vi.spyOn(useDeploymentPickStore(), 'loadOnce').mockReturnValue(
        new Promise(() => {})
      )

      await mountGraphCanvas()
      expect(app.setup).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)

      await vi.waitFor(() => expect(app.setup).toHaveBeenCalledOnce())
      expect(getActivePinia()?.state.value.toast?.toasts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'deploymentSwitcher.lookupUnavailable'
          })
        ])
      )
    }
  )

  describe('when this browser has no hint for the workspace', () => {
    const deployment = {
      deployment_id: 'dep-1',
      release_id: 'r-1',
      status: 'ready',
      created_at: ''
    } as const

    function listingAnswersAt(ms: number, pickedDeploymentId: string | null) {
      const store = useDeploymentPickStore()
      vi.spyOn(store, 'loadOnce').mockReturnValue(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            store.state = {
              phase: 'ready',
              deployments: [deployment],
              pickedDeploymentId,
              pickSource: pickedDeploymentId ? 'browser' : null,
              defaultDeploymentId: null,
              gonePickedDeploymentId: null,
              goneDefaultDeploymentId: null,
              buildsVisible: true
            }
            resolve()
          }, ms)
        })
      )
    }

    function lookupToasts() {
      const toasts: Toast[] = getActivePinia()?.state.value.toast?.toasts ?? []
      return toasts.filter(
        (t) => t.title === 'deploymentSwitcher.lookupUnavailable'
      )
    }

    beforeEach(() => {
      vi.mocked(readDeploymentHint).mockReturnValue('unknown')
    })

    it('boots on Comfy Cloud models after the short wait, with no toast', async () => {
      vi.spyOn(useDeploymentPickStore(), 'loadOnce').mockReturnValue(
        new Promise(() => {})
      )

      await mountGraphCanvas()
      await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_NO_HINT_WAIT_MS - 1)
      expect(app.setup).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)

      await vi.waitFor(() => expect(app.setup).toHaveBeenCalledOnce())
      expect(useDeploymentPickStore().bootDeployment).toBeNull()
      expect(lookupToasts()).toEqual([])
    })

    it.for([
      { answer: 'names a deployment', picked: 'dep-1', toasts: 1 },
      { answer: 'says Comfy Cloud', picked: null, toasts: 0 }
    ])(
      'shows the lookup toast only when a listing that answers late $answer',
      async ({ picked, toasts }) => {
        listingAnswersAt(DEPLOYMENT_LISTING_NO_HINT_WAIT_MS + 2_000, picked)

        await mountGraphCanvas()
        await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_NO_HINT_WAIT_MS)
        await vi.waitFor(() => expect(app.setup).toHaveBeenCalledOnce())
        expect(lookupToasts()).toEqual([])
        await vi.advanceTimersByTimeAsync(2_000)

        expect(lookupToasts()).toHaveLength(toasts)
        expect(useDeploymentPickStore().bootDeployment).toBeNull()
      }
    )
  })

  it('waits for the deployment before constructing workflow widgets', async () => {
    let finishListing = () => {}
    const listing = new Promise<void>((resolve) => {
      finishListing = resolve
    })
    vi.spyOn(useDeploymentPickStore(), 'loadOnce').mockReturnValue(listing)
    await mountGraphCanvas()
    expect(app.setup).not.toHaveBeenCalled()
    useDeploymentPickStore().bootDeployment = null
    finishListing()
    await vi.waitFor(() => expect(app.setup).toHaveBeenCalledOnce())
  })

  it.for([true, false])(
    'does not resume startup after unmount when deployment lookup succeeds: %s',
    async (succeeds) => {
      const store = useDeploymentPickStore()
      let finishListing = () => {}
      const listing = new Promise<void>((resolve) => {
        finishListing = resolve
      })
      vi.spyOn(store, 'loadOnce').mockReturnValue(listing)
      await mountGraphCanvas()
      expect(store.loadOnce).toHaveBeenCalledOnce()
      expect(app.setup).not.toHaveBeenCalled()

      cleanup()
      store.bootDeployment = succeeds ? null : undefined
      finishListing()
      await vi.advanceTimersByTimeAsync(0)

      expect(app.setup).not.toHaveBeenCalled()
      expect(mocks.initializeWorkflow).not.toHaveBeenCalled()
      expect(getActivePinia()?.state.value.toast?.toasts ?? []).toEqual([])
    }
  )

  it.for([true, false])(
    'clears abandoned startup when lookup eventually succeeds: %s',
    async (succeeds) => {
      const store = useDeploymentPickStore()
      let finishListing = () => {}
      vi.spyOn(store, 'loadOnce').mockReturnValue(
        new Promise<void>((resolve) => {
          finishListing = resolve
        })
      )
      const complete = vi.spyOn(bootstrapTracer, 'complete')
      await mountGraphCanvas()
      expect(useWorkspaceStore().spinner).toBe(true)

      cleanup()
      await nextTick()

      expect(useWorkspaceStore().spinner).toBe(false)
      expect(complete).not.toHaveBeenCalled()

      store.bootDeployment = succeeds ? null : undefined
      finishListing()
      await vi.advanceTimersByTimeAsync(0)

      expect(useWorkspaceStore().spinner).toBe(false)
      expect(complete).not.toHaveBeenCalled()
      expect(app.setup).not.toHaveBeenCalled()
    }
  )

  it.for([
    { name: 'immediate', remount: () => mountGraphCanvas() },
    {
      name: 'after a Vue flush',
      remount: () => nextTick().then(() => mountGraphCanvas())
    }
  ])(
    'lets the replacement editor finish startup: $name',
    async ({ remount }) => {
      const store = useDeploymentPickStore()
      let finishListing = () => {}
      vi.spyOn(store, 'loadOnce').mockReturnValue(
        new Promise<void>((resolve) => {
          finishListing = resolve
        })
      )
      let finishSetup = () => {}
      vi.mocked(app.setup).mockReturnValue(
        new Promise<void>((resolve) => {
          finishSetup = resolve
        })
      )
      const complete = vi.spyOn(bootstrapTracer, 'complete')
      await mountGraphCanvas()
      cleanup()
      await remount()

      store.bootDeployment = null
      finishListing()
      await vi.advanceTimersByTimeAsync(0)

      expect(app.setup).toHaveBeenCalledOnce()
      expect(useWorkspaceStore().spinner).toBe(true)
      expect(complete).not.toHaveBeenCalled()

      finishSetup()
      await vi.advanceTimersByTimeAsync(0)

      expect(useWorkspaceStore().spinner).toBe(false)
      expect(complete).toHaveBeenCalledExactlyOnceWith('completed')
      expect(mocks.initializeWorkflow).toHaveBeenCalledOnce()
    }
  )

  it('boots on Comfy Cloud models with a Reload toast after a failed lookup', async () => {
    const store = useDeploymentPickStore()
    vi.spyOn(store, 'loadOnce').mockResolvedValue()
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    await mountGraphCanvas()
    await vi.waitFor(() => expect(app.setup).toHaveBeenCalledOnce())
    expect(store.bootDeployment).toBeNull()
    const toasts: Toast[] = getActivePinia()?.state.value.toast?.toasts ?? []
    const toast = toasts.find(
      (t) => t.title === 'deploymentSwitcher.lookupUnavailable'
    )
    expect(toast).toMatchObject({
      kind: 'error',
      description: 'deploymentSwitcher.lookupUnavailableDetail',
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'deploymentSwitcher.reload' }
    })
    toast?.action?.onClick()
    expect(reload).toHaveBeenCalledOnce()
    store.bootDeployment = {
      deployment_id: 'dep-1',
      release_id: 'r-1',
      build_id: 'b-1',
      build_name: 'Build',
      release_version: 1,
      status: 'ready',
      created_at: ''
    }
    await nextTick()
    expect(app.setup).toHaveBeenCalledOnce()
  })

  it('shows no lookup toast when the lookup settles the boot source', async () => {
    const store = useDeploymentPickStore()
    vi.spyOn(store, 'loadOnce').mockImplementation(async () => {
      store.bootDeployment = null
    })
    await mountGraphCanvas()
    await vi.waitFor(() => expect(app.setup).toHaveBeenCalledOnce())
    expect(getActivePinia()?.state.value.toast?.toasts ?? []).toEqual([])
  })

  it('does not wait for a deployment lookup on a local build', async () => {
    distribution.isCloud = false
    vi.spyOn(useDeploymentPickStore(), 'loadOnce').mockReturnValue(
      new Promise(() => {})
    )
    await mountGraphCanvas()
    expect(app.setup).toHaveBeenCalledOnce()
    expect(useDeploymentPickStore().loadOnce).not.toHaveBeenCalled()
  })

  it('boots on Comfy Cloud models if the deployment lookup never settles', async () => {
    vi.spyOn(useDeploymentPickStore(), 'loadOnce').mockReturnValue(
      new Promise(() => {})
    )
    await mountGraphCanvas()
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS - 1)
    expect(app.setup).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(getActivePinia()?.state.value.toast?.toasts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'error',
          title: 'deploymentSwitcher.lookupUnavailable'
        })
      ])
    )
    expect(useDeploymentPickStore().bootDeployment).toBeNull()
    await vi.waitFor(() => expect(app.setup).toHaveBeenCalledOnce())
    expect(mocks.initializeWorkflow).toHaveBeenCalledOnce()
  })

  it('boots on the deployment when the lookup answers slowly', async () => {
    const store = useDeploymentPickStore()
    const deployment = {
      deployment_id: 'dep-1',
      release_id: 'r-1',
      build_id: 'b-1',
      build_name: 'Build',
      release_version: 1,
      status: 'ready',
      created_at: ''
    } as const
    vi.spyOn(store, 'loadOnce').mockReturnValue(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          store.bootDeployment = deployment
          resolve()
        }, 3_000)
      })
    )
    let bootedOn: unknown = 'not booted'
    vi.mocked(app.setup).mockImplementation(async () => {
      bootedOn = store.bootDeployment
    })
    await mountGraphCanvas()
    await vi.advanceTimersByTimeAsync(2_999)
    expect(app.setup).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(app.setup).toHaveBeenCalledOnce()
    expect(bootedOn).toEqual(deployment)
    await vi.advanceTimersByTimeAsync(DEPLOYMENT_LISTING_BACKSTOP_MS)
    expect(store.bootDeployment).toEqual(deployment)
    expect(app.setup).toHaveBeenCalledOnce()
    expect(mocks.initializeWorkflow).toHaveBeenCalledOnce()
    expect(getActivePinia()?.state.value.toast?.toasts ?? []).toEqual([])
  })
})
