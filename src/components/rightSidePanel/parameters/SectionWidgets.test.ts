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

const setDirty = vi.fn()
const selectedItems: unknown[] = []

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { setDirty },
    selectedItems
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    getInputSpecForWidget: vi.fn()
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

  function renderWidgetsSection(isDraggable: boolean) {
    const { host, promotedWidget } = createHostWithPromotedModel()
    return render(SectionWidgets, {
      props: {
        widgets: [{ widget: promotedWidget, node: host }],
        isDraggable
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
  }

  it('disables the reorder FLIP on draggable sections so they do not jump on drop', () => {
    renderWidgetsSection(true)
    expect(screen.getByTestId('section-widgets-list')).toHaveClass(
      'list-move-disabled'
    )
  })

  it('keeps the reorder FLIP on non-draggable sections', () => {
    renderWidgetsSection(false)
    expect(screen.getByTestId('section-widgets-list')).not.toHaveClass(
      'list-move-disabled'
    )
  })
})
