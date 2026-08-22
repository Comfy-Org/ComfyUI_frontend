import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { toNodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'

import AppModeWidgetList from './AppModeWidgetList.vue'

const mocks = vi.hoisted(() => ({
  extractVueNodeData: vi.fn(),
  resolvedInputs: { value: [] as unknown[] }
}))

vi.mock('@/components/builder/useResolvedSelectedInputs', () => ({
  useResolvedSelectedInputs: () => mocks.resolvedInputs
}))

vi.mock('@/composables/graph/useGraphNodeManager', () => ({
  extractVueNodeData: mocks.extractVueNodeData
}))

vi.mock('@/composables/maskeditor/useMaskEditor', () => ({
  useMaskEditor: () => ({ openMaskEditor: vi.fn() })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { graph: { rootGraph: { id: 'graph-test' } } }
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers',
  () => ({
    useNodeEventHandlers: () => ({ handleNodeRightClick: vi.fn() })
  })
)

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeTooltips', () => ({
  useNodeTooltips: () => ({
    createTooltipConfig: () => ({}),
    getWidgetTooltip: () => ''
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry',
  () => ({
    getComponent: () => ({
      props: ['widget'],
      template: '<div data-testid="advanced-widget-control" />'
    }),
    shouldExpand: () => false,
    shouldRenderAsVue: () => true
  })
)

vi.mock('@/scripts/app', () => ({
  app: {
    isGraphReady: false,
    rootGraph: { id: 'graph-test' }
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { remove: 'Remove', rename: 'Rename' }
    }
  }
})

describe('AppModeWidgetList', () => {
  beforeEach(() => {
    const widgetId = 'graph-test:1:max_shift' as WidgetId
    const widget = fromAny<IBaseWidget, unknown>({
      label: 'Max shift',
      name: 'max_shift',
      widgetId
    })
    const node = fromAny<LGraphNode, unknown>({
      id: toNodeId(1),
      mode: LGraphEventMode.ALWAYS,
      title: 'Subgraph',
      type: 'SubgraphNode'
    })
    const nodeData: VueNodeData = {
      executing: false,
      id: toNodeId(1),
      inputs: [],
      mode: LGraphEventMode.ALWAYS,
      outputs: [],
      selected: false,
      title: 'Subgraph',
      type: 'SubgraphNode',
      widgets: [
        {
          name: 'max_shift',
          options: { advanced: true },
          slotMetadata: {
            index: 0,
            linked: false,
            promoted: true,
            type: 'FLOAT'
          },
          type: 'number',
          widgetId
        }
      ]
    }

    mocks.resolvedInputs.value = [
      {
        displayName: 'max_shift',
        node,
        status: 'resolved',
        widget,
        widgetId
      }
    ]
    mocks.extractVueNodeData.mockReturnValue(nodeData)
  })

  it('renders a selected promoted advanced widget', () => {
    const pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)

    render(AppModeWidgetList, {
      global: {
        directives: { tooltip: { mounted: () => {} } },
        plugins: [pinia, i18n],
        stubs: {
          Button: { template: '<button><slot /></button>' },
          DropZone: { template: '<div><slot /></div>' },
          InputSlot: true,
          Popover: { template: '<div><slot name="button" /></div>' },
          WidgetDescription: true
        }
      }
    })

    expect(screen.getByTestId('advanced-widget-control')).toBeVisible()
  })
})
