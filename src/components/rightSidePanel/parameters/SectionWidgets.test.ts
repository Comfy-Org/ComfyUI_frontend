import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { NodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'

import SectionWidgets from './SectionWidgets.vue'

const { mockGetInputSpecForWidget, mockTrackUiButtonClicked } = vi.hoisted(
  () => ({
    mockGetInputSpecForWidget: vi.fn(),
    mockTrackUiButtonClicked: vi.fn()
  })
)

const setDirty = vi.fn()
const getNodeById = vi.fn()
const animateToBounds = vi.fn()
const selectedItems: unknown[] = []

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { setDirty, graph: { getNodeById }, animateToBounds },
    selectedItems
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    getInputSpecForWidget: mockGetInputSpecForWidget
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackUiButtonClicked: mockTrackUiButtonClicked
  })
}))

const WidgetItemStub = defineComponent({
  inheritAttrs: false,
  emits: ['update:widget-value', 'reset-to-default'],
  template: `
    <button
      data-testid="widget-edit"
      @click="$emit('update:widget-value', 'real_model.safetensors')"
    />
  `
})

const PropertiesAccordionItemStub = defineComponent({
  inheritAttrs: false,
  emits: ['update:collapse'],
  template: '<section><slot name="label" /><slot /></section>'
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      rightSidePanel: {
        inputs: 'Inputs',
        resetAllParameters: 'Reset all',
        locateNode: 'Locate',
        seeError: 'See error'
      }
    }
  }
})

function createHostWithPromotedModel(): {
  host: SubgraphNode
  promotedWidget: IBaseWidget
  sourceWidget: IBaseWidget
  sourceExecutionId: NodeExecutionId
  hostExecutionId: NodeExecutionId
} {
  const subgraph = createTestSubgraph()
  const host = createTestSubgraphNode(subgraph, { id: 65 })
  const graph = host.graph as LGraph
  graph.add(host)

  const sourceNode = new LGraphNode('CheckpointLoaderSimple')
  sourceNode.id = toNodeId(42)
  const sourceInput = sourceNode.addInput('ckpt_name', 'COMBO')
  const sourceWidget = sourceNode.addWidget(
    'combo',
    'ckpt_name',
    'missing_model.safetensors',
    () => {},
    { values: ['real_model.safetensors'] }
  )
  sourceInput.widget = { name: sourceWidget.name }
  subgraph.add(sourceNode)

  expect(
    promoteValueWidgetViaSubgraphInput(host, sourceNode, sourceWidget).ok
  ).toBe(true)

  const promotedWidget = host.widgets?.find(
    (widget) => widget.name === sourceWidget.name
  )
  if (!promotedWidget) throw new Error('Expected promoted widget')

  const rootGraph = host.rootGraph
  const sourceExecutionId = getExecutionIdByNode(rootGraph, sourceNode)
  const hostExecutionId = getExecutionIdByNode(rootGraph, host)
  if (!sourceExecutionId || !hostExecutionId) {
    throw new Error('Expected execution ids')
  }

  return {
    host,
    promotedWidget,
    sourceWidget,
    sourceExecutionId,
    hostExecutionId
  }
}

describe('SectionWidgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    setDirty.mockClear()
    getNodeById.mockReset()
    animateToBounds.mockClear()
    mockGetInputSpecForWidget.mockReset()
    mockTrackUiButtonClicked.mockClear()
    selectedItems.length = 0
  })

  it('clears promoted widget validation by source and missing model by host', async () => {
    const {
      host,
      promotedWidget,
      sourceWidget,
      sourceExecutionId,
      hostExecutionId
    } = createHostWithPromotedModel()
    const executionErrorStore = useExecutionErrorStore()
    const clearSpy = vi.spyOn(executionErrorStore, 'clearWidgetRelatedErrors')
    const user = userEvent.setup()

    render(SectionWidgets, {
      props: {
        widgets: [{ widget: promotedWidget, node: host }]
      },
      global: {
        plugins: [i18n],
        stubs: {
          Button: true,
          WidgetItem: WidgetItemStub,
          PropertiesAccordionItem: PropertiesAccordionItemStub
        }
      }
    })

    await user.click(screen.getByTestId('widget-edit'))

    expect(clearSpy).toHaveBeenNthCalledWith(
      1,
      sourceExecutionId,
      sourceWidget.name,
      sourceWidget.name,
      'real_model.safetensors',
      { min: undefined, max: undefined }
    )
    expect(clearSpy).toHaveBeenNthCalledWith(
      2,
      hostExecutionId,
      promotedWidget.name,
      promotedWidget.name,
      'real_model.safetensors',
      { min: undefined, max: undefined }
    )
  })

  function createSimpleNodeWithWidget(): {
    node: LGraphNode
    widget: IBaseWidget
  } {
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.id = toNodeId(7)
    const widget = node.addWidget(
      'combo',
      'ckpt_name',
      'model.safetensors',
      () => {},
      { values: ['model.safetensors'] }
    )
    return { node, widget }
  }

  it('tracks and locates the node when the Locate button is clicked', async () => {
    const { node, widget } = createSimpleNodeWithWidget()
    const boundingRect = [0, 0, 100, 100]
    getNodeById.mockReturnValue({ boundingRect })
    const user = userEvent.setup()

    render(SectionWidgets, {
      props: {
        widgets: [{ widget, node }],
        showLocateButton: true
      },
      global: {
        plugins: [i18n],
        stubs: {
          WidgetItem: WidgetItemStub,
          PropertiesAccordionItem: PropertiesAccordionItemStub
        }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Locate' }))

    expect(mockTrackUiButtonClicked).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_locate_node_clicked',
      element_group: 'right_side_panel_nodes'
    })
    expect(getNodeById).toHaveBeenCalledWith(node.id)
    expect(animateToBounds).toHaveBeenCalledWith(boundingRect)
  })

  it('tracks and resets all widgets when the Reset all button is clicked', async () => {
    const { node, widget } = createSimpleNodeWithWidget()
    mockGetInputSpecForWidget.mockReturnValue({
      type: 'COMBO',
      default: 'default_model.safetensors'
    })
    const user = userEvent.setup()

    render(SectionWidgets, {
      props: {
        widgets: [{ widget, node }]
      },
      global: {
        plugins: [i18n],
        stubs: {
          WidgetItem: WidgetItemStub,
          PropertiesAccordionItem: PropertiesAccordionItemStub
        }
      }
    })

    await user.click(screen.getByRole('button', { name: 'Reset all' }))

    expect(mockTrackUiButtonClicked).toHaveBeenCalledExactlyOnceWith({
      button_id: 'right_side_panel_reset_all_parameters_clicked',
      element_group: 'right_side_panel_nodes'
    })
    expect(widget.value).toBe('default_model.safetensors')
  })
})
