import { getActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, markRaw, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import PropertiesPanel from '@/renderer/extensions/propertiesPanel/PropertiesPanel.vue'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useDeprecatedNodesStore } from '@/platform/workflowErrors/nodeReplacement/deprecatedNodesStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import '@/scripts/changeTracker'

const mockApp = vi.hoisted(() => ({
  isGraphReady: true,
  rootGraph: null as LGraph | null,
  get rootGraphOrUndefined() {
    return this.rootGraph ?? undefined
  }
}))

vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAskAgentAboutIssues'),
  () => ({
    useAskAgentAboutIssues: () => ({
      canAskAgent: computed(() => false),
      askAgentAboutIssues: vi.fn(() => Promise.resolve())
    })
  })
)

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: mockApp }))

vi.mock(import('@/composables/canvas/useFocusNode'), () => ({
  useFocusNode: () => ({
    focusNode: vi.fn(),
    focusNodeInstance: vi.fn()
  })
}))

vi.mock(import('@comfyorg/telemetry'))

function createPanelI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
}

const panelStubs = {
  EditableText: true,
  Tab: { template: '<button v-bind="$attrs"><slot /></button>' },
  TabErrors: true,
  TabInfo: true,
  TabList: { template: '<div><slot /></div>' },
  TabNormalInputs: true,
  TabSettings: true
}

function renderPanel(
  activeTab: 'errors' | 'parameters' = 'errors',
  graphContext?: {
    rootGraph: LGraph
    currentGraph: LGraph
    node: LGraphNode
  },
  pinia = getActivePinia()!
) {
  useSettingStore().$patch({
    settingValues: {
      'Comfy.RightSidePanel.ShowErrorsTab': true,
      'Comfy.Sidebar.Location': 'left',
      'Comfy.UseNewMenu': 'Top',
      'Comfy.RightSidePanel.IsOpen': true
    }
  })

  const rootGraph = graphContext?.rootGraph ?? new LGraph()
  const currentGraph = graphContext?.currentGraph ?? rootGraph
  const node = graphContext?.node ?? new LGraphNode('CheckpointLoaderSimple')
  if (!graphContext) {
    node.id = toNodeId(1)
    rootGraph.add(node)
  }
  mockApp.rootGraph = rootGraph

  const canvasStore = useCanvasStore()
  canvasStore.currentGraph = currentGraph
  setCanvasSelection([markRaw(node)])

  const propertiesPanelStore = usePropertiesPanelStore()
  propertiesPanelStore.activeTab = activeTab
  const executionErrorStore = useExecutionErrorStore()
  const executionId = getExecutionIdByNode(rootGraph, node)
  if (!executionId) throw new Error('Expected selected node execution ID')
  const finishScan = executionErrorStore.beginAddedNodeErrorScan(
    rootGraph,
    executionId
  )
  const openPanel = vi.spyOn(propertiesPanelStore, 'openPanel')

  const rendered = render(PropertiesPanel, {
    global: {
      plugins: [pinia, createPanelI18n()],
      stubs: panelStubs
    }
  })

  return {
    ...rendered,
    executionId,
    executionErrorStore,
    finishScan,
    graph: rootGraph,
    node,
    openPanel,
    propertiesPanelStore
  }
}

describe('PropertiesPanel active tab fallback', () => {
  beforeEach(() => {
    mockApp.rootGraph = null
  })

  it('keeps the active errors tab until the selected node scan settles', async () => {
    const { finishScan, openPanel, propertiesPanelStore } = renderPanel()

    expect(screen.getByTestId('panel-tab-errors')).toBeInTheDocument()
    expect(propertiesPanelStore.activeTab).toBe('errors')
    expect(openPanel).not.toHaveBeenCalled()

    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(() => undefined)
    finishScan()
    await nextTick()

    expect(propertiesPanelStore.activeTab).toBe('parameters')
    expect(openPanel).toHaveBeenCalledWith('parameters')
  })

  it('keeps errors active when the scan surfaces an error before settling', async () => {
    const { executionId, finishScan, openPanel, propertiesPanelStore } =
      renderPanel()

    useMissingModelStore().addMissingModels([
      {
        nodeId: executionId,
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        directory: 'checkpoints',
        isMissing: true
      }
    ])
    finishScan()
    await nextTick()

    expect(propertiesPanelStore.activeTab).toBe('errors')
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('does not show errors solely because a scan is pending', () => {
    const { openPanel } = renderPanel('parameters')

    expect(screen.queryByTestId('panel-tab-errors')).not.toBeInTheDocument()
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('shows the errors tab with a notice icon when only deprecated nodes are listed', async () => {
    const { finishScan } = renderPanel('parameters')
    finishScan()
    useDeprecatedNodesStore().nodeTypes = [
      { type: 'ImageBatch', nodeId: '1', isReplaceable: true }
    ]
    await nextTick()

    expect(screen.getByTestId('panel-tab-errors')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Deprecated nodes can be replaced' })
    ).toBeInTheDocument()
  })

  it('does not update the panel when a pending scan finishes after unmount', async () => {
    const { finishScan, openPanel, unmount } = renderPanel()
    unmount()
    finishScan()
    await nextTick()

    expect(openPanel).not.toHaveBeenCalled()
  })

  it('keeps errors active for a pending subgraph interior node scan', () => {
    const pinia = getActivePinia()!

    useSettingStore().$patch({
      settingValues: {
        'Comfy.RightSidePanel.ShowErrorsTab': true,
        'Comfy.Sidebar.Location': 'left',
        'Comfy.UseNewMenu': 'Top',
        'Comfy.RightSidePanel.IsOpen': true
      }
    })
    const subgraph = createTestSubgraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.id = toNodeId(7)
    subgraph.add(node)
    const host = createTestSubgraphNode(subgraph, { id: 65 })
    const rootGraph = host.graph as LGraph
    rootGraph.add(host)

    const {
      executionErrorStore,
      executionId,
      openPanel,
      propertiesPanelStore
    } = renderPanel(
      'errors',
      { rootGraph, currentGraph: subgraph, node },
      pinia
    )

    expect(
      executionErrorStore.hasPendingAddedNodeErrorScan(rootGraph, executionId)
    ).toBe(true)
    expect(screen.getByTestId('panel-tab-errors')).toBeInTheDocument()
    expect(propertiesPanelStore.activeTab).toBe('errors')
    expect(openPanel).not.toHaveBeenCalled()
  })
})

describe('PropertiesPanel errors tab icon', () => {
  beforeEach(() => {
    mockApp.rootGraph = null
  })

  it('marks missing resources on the selected node as setup required', async () => {
    const { executionId } = renderPanel('parameters')

    useMissingModelStore().addMissingModels([
      {
        nodeId: executionId,
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        directory: 'checkpoints',
        isMissing: true
      }
    ])
    await nextTick()

    expect(screen.getByTestId('panel-tab-icon')).toHaveAccessibleName(
      'Setup required'
    )
  })

  it('marks a validation error on the selected node as blocking', async () => {
    renderPanel('parameters')

    useExecutionErrorStore().recordNodeErrors({
      '1': nodeError(
        [validationError('value_not_in_list', 'ckpt_name')],
        'CheckpointLoaderSimple'
      )
    })
    await nextTick()

    expect(screen.getByTestId('panel-tab-icon')).toHaveAccessibleName(
      'Blocking errors'
    )
  })
})

describe('PropertiesPanel global parameters tab', () => {
  beforeEach(() => {
    mockApp.rootGraph = null
  })

  function renderWithNoSelection(
    activeWorkflowPath: string | null,
    pinia = getActivePinia()!
  ) {
    useSettingStore().$patch({
      settingValues: {
        'Comfy.RightSidePanel.ShowErrorsTab': true,
        'Comfy.Sidebar.Location': 'left',
        'Comfy.UseNewMenu': 'Top',
        'Comfy.RightSidePanel.IsOpen': true
      }
    })
    const onTabGlobalParametersSetup = vi.fn()

    const rootGraph = new LGraph()
    mockApp.rootGraph = rootGraph

    const canvasStore = useCanvasStore()
    canvasStore.currentGraph = rootGraph
    setCanvasSelection([])

    const propertiesPanelStore = usePropertiesPanelStore()
    propertiesPanelStore.activeTab = 'parameters'

    const workflowStore = useWorkflowStore()
    workflowStore.activeWorkflow = activeWorkflowPath
      ? ({ path: activeWorkflowPath } as LoadedComfyWorkflow)
      : null

    const rendered = render(PropertiesPanel, {
      global: {
        plugins: [pinia, createPanelI18n()],
        stubs: {
          ...panelStubs,
          TabGlobalParameters: {
            setup: onTabGlobalParametersSetup,
            template: '<div data-testid="tab-global-parameters" />'
          }
        }
      }
    })

    return { ...rendered, onTabGlobalParametersSetup }
  }

  it('remounts TabGlobalParameters when the active workflow changes', async () => {
    const { onTabGlobalParametersSetup } =
      renderWithNoSelection('workflows/a.json')

    const first = screen.getByTestId('tab-global-parameters')
    expect(onTabGlobalParametersSetup).toHaveBeenCalledTimes(1)

    const workflowStore = useWorkflowStore()
    workflowStore.activeWorkflow = {
      path: 'workflows/b.json'
    } as LoadedComfyWorkflow
    await nextTick()

    expect(onTabGlobalParametersSetup).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('tab-global-parameters')).not.toBe(first)
  })
})
