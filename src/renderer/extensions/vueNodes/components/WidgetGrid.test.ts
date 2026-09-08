import { render, screen } from '@testing-library/vue'
import { defineComponent, markRaw } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { toNodeId } from '@/types/nodeId'

const { mockDragState, resetDragState } = vi.hoisted(() => {
  const mockDragState = {
    active: false,
    candidate: null as {
      layout: { nodeId: string; index: number; type: string }
      compatible: boolean
    } | null
  }

  return {
    mockDragState,
    resetDragState: () => {
      mockDragState.active = false
      mockDragState.candidate = null
    }
  }
})

vi.mock('@/renderer/core/canvas/links/slotLinkDragUIState', () => ({
  useSlotLinkDragUIState: () => ({ state: mockDragState })
}))

const WidgetStub = markRaw(
  defineComponent({
    props: { invalid: Boolean },
    template:
      '<div data-testid="widget-wrapper"><input data-testid="widget-control" :aria-invalid="invalid || undefined" /></div>'
  })
)

const InputSlotStub = defineComponent({
  props: {
    index: { type: Number, required: true },
    slotData: { type: Object, required: true }
  },
  template:
    '<div data-testid="input-slot" :data-index="index" :data-name="slotData.name" />'
})

const AppInputStub = defineComponent({
  props: {
    name: { type: String, required: true }
  },
  template:
    '<div data-testid="app-input" :data-widget-name="name"><slot /></div>'
})

function widget(name: string, type: string, index: number): WidgetGridItem {
  return {
    renderKey: name,
    simplified: { name, type, value: 0 },
    slotMetadata: {
      index,
      linked: false,
      promoted: false,
      type: 'FLOAT'
    },
    visible: true,
    vueComponent: WidgetStub
  }
}

describe('WidgetGrid', () => {
  afterEach(resetDragState)

  it('renders hidden converted widgets as input sockets without controls', () => {
    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [
          { ...widget('seed', 'converted-widget', 0), visible: false },
          {
            ...widget('control_after_generate', 'converted-widget:seed', 1),
            slotMetadata: undefined
          },
          widget('replacement', 'number', 2),
          widget('converted-widget-picker', 'converted-widget-picker', 3),
          { ...widget('hidden', 'number', 4), visible: false }
        ]
      },
      global: {
        directives: { tooltip: {} },
        stubs: {
          AppInput: AppInputStub,
          InputSlot: InputSlotStub
        }
      }
    })

    expect(
      screen.getAllByTestId('input-slot').map((element) => element.dataset.name)
    ).toEqual(['seed', 'replacement', 'converted-widget-picker'])
    expect(screen.getAllByTestId('node-widget')).toHaveLength(2)
    expect(
      screen
        .getAllByTestId('app-input')
        .map((element) => element.dataset.widgetName)
    ).toEqual(['replacement', 'converted-widget-picker'])
    expect(screen.getAllByTestId('widget-control')).toHaveLength(2)
  })

  it('passes execution errors to the widget control API', () => {
    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [{ ...widget('seed', 'string', 0), hasError: true }]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('widget-control')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByTestId('widget-wrapper')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByTestId('app-input')).not.toHaveAttribute('aria-invalid')
  })

  it('highlights the compatible widget targeted by a link drag', () => {
    mockDragState.active = true
    mockDragState.candidate = {
      layout: { nodeId: '1', index: 0, type: 'input' },
      compatible: true
    }

    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [widget('seed', 'number', 0)]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('node-widget')).toHaveClass(
      'ring',
      'ring-component-node-widget-linked'
    )
  })

  const nonTargetCases = [
    ['inactive drag', false, 'input', '1', 0, true],
    ['incompatible candidate', true, 'input', '1', 0, false],
    ['output candidate', true, 'output', '1', 0, true],
    ['different node', true, 'input', '2', 0, true],
    ['different slot', true, 'input', '1', 1, true]
  ] as const

  for (const [
    name,
    active,
    type,
    nodeId,
    index,
    compatible
  ] of nonTargetCases) {
    it(`does not highlight for ${name}`, () => {
      mockDragState.active = active
      mockDragState.candidate = {
        layout: { nodeId, index, type },
        compatible
      }

      render(WidgetGrid, {
        props: {
          nodeId: toNodeId(1),
          nodeType: 'TestNode',
          processedWidgets: [widget('seed', 'number', 0)]
        },
        global: {
          directives: { tooltip: {} },
          stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
        }
      })

      expect(screen.getByTestId('node-widget')).not.toHaveClass('ring')
    })
  }

  it('marks linked widgets when they are not a drag target', () => {
    const linkedWidget = widget('seed', 'number', 0)
    linkedWidget.slotMetadata!.linked = true

    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [linkedWidget]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('node-widget')).toHaveClass(
      'border-l-2',
      'border-component-node-widget-linked'
    )
  })

  it('prefers drag highlighting over the linked border', () => {
    const linkedWidget = widget('seed', 'number', 0)
    linkedWidget.slotMetadata!.linked = true
    mockDragState.active = true
    mockDragState.candidate = {
      layout: { nodeId: '1', index: 0, type: 'input' },
      compatible: true
    }

    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [linkedWidget]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('node-widget')).toHaveClass('ring')
    expect(screen.getByTestId('node-widget')).not.toHaveClass('border-l-2')
  })

  it('shows widget slots while a link drag is active', () => {
    mockDragState.active = true

    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [widget('seed', 'number', 0)]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('widget-slot-container')).toHaveClass(
      'opacity-100'
    )
    expect(screen.getByTestId('widget-slot-container')).not.toHaveClass(
      'opacity-0'
    )
  })

  it('hides an unlinked widget slot when no link drag is active', () => {
    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [widget('seed', 'number', 0)]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('widget-slot-container')).toHaveClass(
      'opacity-0',
      'group-hover:opacity-100'
    )
  })

  it('shows a linked widget slot without a link drag', () => {
    const linkedWidget = widget('seed', 'number', 0)
    linkedWidget.slotMetadata!.linked = true

    render(WidgetGrid, {
      props: {
        nodeId: toNodeId(1),
        nodeType: 'TestNode',
        processedWidgets: [linkedWidget]
      },
      global: {
        directives: { tooltip: {} },
        stubs: { AppInput: AppInputStub, InputSlot: InputSlotStub }
      }
    })

    expect(screen.getByTestId('widget-slot-container')).toHaveClass(
      'opacity-100'
    )
  })
})
