import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import RightSidePanel from '@/components/rightSidePanel/RightSidePanel.vue'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'

const mockApp = vi.hoisted(() => ({
  isGraphReady: true,
  rootGraph: null as LGraph | null
}))

vi.mock('@/scripts/app', () => ({ app: mockApp }))

vi.mock('@/composables/graph/useGraphHierarchy', () => ({
  useGraphHierarchy: () => ({ findParentGroup: vi.fn(() => null) })
}))

vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => undefined }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => {
      if (key === 'Comfy.RightSidePanel.ShowErrorsTab') return true
      if (key === 'Comfy.Sidebar.Location') return 'left'
      if (key === 'Comfy.UseNewMenu') return 'Top'
      if (key === 'Comfy.RightSidePanel.IsOpen') return true
      return undefined
    },
    set: vi.fn()
  })
}))

function renderPanel(activeTab: 'errors' | 'parameters' = 'errors') {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  setActivePinia(pinia)

  const graph = new LGraph()
  const node = new LGraphNode('CheckpointLoaderSimple')
  node.id = toNodeId(1)
  graph.add(node)
  mockApp.rootGraph = graph

  const canvasStore = useCanvasStore()
  canvasStore.currentGraph = graph
  canvasStore.selectedItems = [node]

  const rightSidePanelStore = useRightSidePanelStore()
  rightSidePanelStore.activeTab = activeTab
  const executionErrorStore = useExecutionErrorStore()
  const executionId = createNodeExecutionId([node.id])
  const finishScan = executionErrorStore.beginAddedNodeErrorScan(
    graph,
    executionId
  )
  const openPanel = vi.spyOn(rightSidePanelStore, 'openPanel')

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: { settings: 'Settings' },
        rightSidePanel: {
          errors: 'Errors',
          parameters: 'Parameters',
          info: 'Info',
          togglePanel: 'Toggle panel',
          fallbackNodeTitle: 'Node'
        }
      }
    }
  })

  const rendered = render(RightSidePanel, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        Button: { template: '<button><slot /></button>' },
        EditableText: true,
        Tab: { template: '<button v-bind="$attrs"><slot /></button>' },
        TabErrors: true,
        TabInfo: true,
        TabList: { template: '<div><slot /></div>' },
        TabNormalInputs: true,
        TabSettings: true
      }
    }
  })

  return {
    ...rendered,
    executionId,
    executionErrorStore,
    finishScan,
    graph,
    node,
    openPanel,
    rightSidePanelStore
  }
}

describe('RightSidePanel active tab fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockApp.rootGraph = null
  })

  it('keeps the active errors tab until the selected node scan settles', async () => {
    const { finishScan, openPanel, rightSidePanelStore } = renderPanel()

    expect(screen.getByTestId('panel-tab-errors')).toBeInTheDocument()
    expect(rightSidePanelStore.activeTab).toBe('errors')
    expect(openPanel).not.toHaveBeenCalled()

    finishScan()
    await Promise.resolve()

    expect(rightSidePanelStore.activeTab).toBe('parameters')
    expect(openPanel).toHaveBeenCalledWith('parameters')
  })

  it('keeps errors active when the scan surfaces an error before settling', async () => {
    const { executionId, finishScan, openPanel, rightSidePanelStore } =
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

    expect(rightSidePanelStore.activeTab).toBe('errors')
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('does not show errors solely because a scan is pending', () => {
    const { openPanel } = renderPanel('parameters')

    expect(screen.queryByTestId('panel-tab-errors')).not.toBeInTheDocument()
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('does not update the panel after unmount', async () => {
    const { finishScan, openPanel, unmount } = renderPanel()
    finishScan()
    await Promise.resolve()
    openPanel.mockClear()
    unmount()
    await Promise.resolve()

    expect(openPanel).not.toHaveBeenCalled()
  })
})
