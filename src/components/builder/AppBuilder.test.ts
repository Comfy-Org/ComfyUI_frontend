import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import AppBuilder from './AppBuilder.vue'

vi.mock('@/composables/useAppMode', async () => {
  const { ref } = await import('vue')
  return {
    useAppMode: () => ({
      isSelectMode: ref(true),
      isSelectInputsMode: ref(true),
      isSelectOutputsMode: ref(false),
      isArrangeMode: ref(false),
      isAppMode: ref(false),
      isBuilderMode: ref(true),
      mode: ref('builder:inputs'),
      setMode: vi.fn()
    })
  }
})

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      id: '11111111-1111-4111-8111-111111111111',
      nodes: [],
      events: new EventTarget(),
      getNodeById: vi.fn()
    }
  }
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

describe('AppBuilder', () => {
  it('does not select panel-hidden widgets as app inputs', async () => {
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    const graph = new LGraph()
    const canvas = new LGraphCanvas(canvasElement, graph, { skip_render: true })
    const node = new LGraphNode('Source', 'Source')
    const widget = node.addWidget('text', 'hidden', '', () => {})
    graph.add(node)
    if (!widget.visibility)
      throw new Error('Missing concrete widget visibility')
    widget.visibility.surfaces.panel = 'never'
    vi.spyOn(graph, 'getNodeOnPos').mockReturnValue(node)
    vi.spyOn(node, 'getWidgetOnPos').mockReturnValue(widget)
    vi.spyOn(canvas, 'adjustMouseEvent').mockImplementation(() => {})
    useCanvasStore().canvas = canvas

    render(AppBuilder, {
      global: {
        plugins: [i18n],
        stubs: {
          AppModeWidgetList: true,
          DraggableList: true,
          IoItem: true,
          PropertiesAccordionItem: true,
          TransformPane: true
        }
      }
    })

    await userEvent.click(screen.getByTestId('builder-selection-overlay'))

    expect(useAppModeStore().selectedInputs).toEqual([])
  })
})
