import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import AppBuilder from '@/components/builder/AppBuilder.vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { toNodeId } from '@/types/nodeId'
import { createTestNodeDef } from '@/utils/__tests__/litegraphTestUtils'

const mockState = vi.hoisted(() => ({
  nodes: [] as LGraphNode[],
  selectedInputs: [],
  selectedOutputs: [],
  resetChangeTracker: vi.fn()
}))

vi.mock('@/components/builder/useResolvedSelectedInputs', () => ({
  useResolvedSelectedInputs: () => ({ value: [] })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: vi.fn(() => false) })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      activeMode: 'builder:outputs',
      changeTracker: { reset: mockState.resetChangeTracker }
    }
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    getCanvas: () => ({
      graph: {
        get nodes() {
          return mockState.nodes
        }
      },
      adjustMouseEvent: vi.fn()
    })
  })
}))

vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({ forwardEventToCanvas: vi.fn() })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      getNodeById: vi.fn((id) => mockState.nodes.find((node) => node.id === id))
    }
  }
}))

vi.mock('@/stores/appModeStore', async (importOriginal) => ({
  ...(await importOriginal()),
  useAppModeStore: () => ({
    selectedInputs: mockState.selectedInputs,
    selectedOutputs: mockState.selectedOutputs,
    removeSelectedInput: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      nodeHelpPage: { inputs: 'Inputs', outputs: 'Outputs' },
      linearMode: {
        builder: {
          title: 'Builder',
          outputsDesc: 'Choose outputs',
          outputsExample: 'Output example',
          promptAddOutputs: 'Add outputs',
          outputPlaceholder: 'Select an output',
          outputRequiredPlaceholder: 'At least one output is required'
        }
      }
    }
  }
})

function createOutputNode(id: number, type: string): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: toNodeId(id),
    type,
    title: type,
    mode: LGraphEventMode.ALWAYS,
    has_errors: false,
    pos: [0, 0],
    size: [100, 100],
    constructor: { nodeData: { output_node: true } }
  })
}

describe('AppBuilder', () => {
  beforeEach(() => {
    mockState.nodes = []
    mockState.selectedInputs.length = 0
    mockState.selectedOutputs.length = 0
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('renders output overlays only for execution-relevant node types', () => {
    useNodeDefStore().updateNodeDefs([
      createTestNodeDef('LayoutOnlyOutputNode', { layout_only: true })
    ])
    const regularOutput = createOutputNode(1, 'RegularOutputNode')
    const layoutOnlyOutput = createOutputNode(2, 'LayoutOnlyOutputNode')
    mockState.nodes = [regularOutput, layoutOnlyOutput]

    render(AppBuilder, {
      global: {
        plugins: [i18n],
        stubs: {
          AppModeWidgetList: true,
          DraggableList: true,
          IoItem: true,
          PropertiesAccordionItem: true,
          TransformPane: { template: '<div><slot /></div>' }
        }
      }
    })

    expect(
      screen.getByTestId(`builder-output-overlay-${regularOutput.id}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId(`builder-output-overlay-${layoutOnlyOutput.id}`)
    ).not.toBeInTheDocument()
  })
})
