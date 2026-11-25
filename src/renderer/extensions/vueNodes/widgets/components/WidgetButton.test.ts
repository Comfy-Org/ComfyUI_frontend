import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetButton from '@/renderer/extensions/vueNodes/widgets/components/WidgetButton.vue'
import { app } from '@/scripts/app'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { createMockWidget } from './widgetTestUtils'

vi.mock(import('@/scripts/app'))

type ButtonWidgetOptions = IWidgetOptions & {
  variant?: string
  label?: string
}

const BUTTON_DEFAULTS = {
  value: undefined,
  type: 'button',
  name: 'test_button'
} as const

describe('WidgetButton Interactions', () => {
  const createButtonWidget = (
    overrides: Partial<SimplifiedWidget<undefined, ButtonWidgetOptions>> = {}
  ) => createMockWidget<undefined>({ ...BUTTON_DEFAULTS, ...overrides })

  const mountComponent = (widget: SimplifiedWidget<undefined>) => {
    const user = userEvent.setup()
    const result = render(WidgetButton, {
      props: {
        widget,
        nodeId: toNodeId('unmounted-node')
      }
    })
    return { ...result, user }
  }

  describe('Click Handling', () => {
    it('calls the live button callback with its value, graph position and click event, keeping the value', async () => {
      const graph = app.rootGraph
      const node = new LGraphNode('Load3D')
      const callback = vi.fn()
      const liveButton = node.addWidget('button', 'clear', 'clear', callback)
      graph.add(node)
      stubCanvasGetContext()
      const canvas = new LGraphCanvas(document.createElement('canvas'), graph, {
        skip_render: true,
        skip_events: true
      })
      canvas.ds.scale = 2
      canvas.ds.offset = [10, 20]
      useCanvasStore().canvas = canvas
      await nextTick()
      const user = userEvent.setup()
      render(WidgetButton, {
        props: {
          nodeId: node.id,
          widget: createButtonWidget({ name: 'clear' })
        }
      })

      await user.pointer({
        keys: '[MouseLeft]',
        target: screen.getByRole('button'),
        coords: { clientX: 50, clientY: 30 }
      })

      expect(callback).toHaveBeenCalledExactlyOnceWith(
        'clear',
        canvas,
        node,
        [15, -5],
        expect.objectContaining({ type: 'click', canvasX: 15, canvasY: -5 })
      )
      expect(liveButton.value).toBe('clear')
    })
  })

  describe('Component Rendering', () => {
    it('renders widget text when name is provided', () => {
      const widget = createButtonWidget()
      mountComponent(widget)

      expect(screen.getByRole('button')).toHaveTextContent('test_button')
    })

    it('sets button size to sm', () => {
      const widget = createButtonWidget()
      mountComponent(widget)

      expect(screen.getByRole('button')).toHaveClass('h-6', 'rounded-sm')
    })
  })

  describe('Widget Options', () => {
    it('handles button with label', () => {
      const widget = createButtonWidget({
        name: 'btn',
        label: 'Click Me',
        options: { label: 'Click Me' }
      })
      mountComponent(widget)

      expect(screen.getByRole('button')).toHaveTextContent('Click Me')
    })

    it('handles button with iconClass', () => {
      const widget = createButtonWidget({
        options: { iconClass: 'pi pi-star' }
      })
      const { container } = mountComponent(widget)

      // oxlint-disable-next-line testing-library/no-node-access
      expect(container.querySelector('i.pi.pi-star')).not.toBeNull()
    })

    it('handles button with both label and iconClass', () => {
      const widget = createButtonWidget({
        label: 'Save',
        options: { iconClass: 'pi pi-save' }
      })
      const { container } = mountComponent(widget)

      expect(screen.getByRole('button')).toHaveTextContent('Save')
      // oxlint-disable-next-line testing-library/no-node-access
      expect(container.querySelector('i.pi.pi-save')).not.toBeNull()
    })

    it.for([
      ['secondary', 'hover:bg-accent'],
      ['primary', 'hover:bg-primary/90'],
      ['inverted', 'hover:bg-foreground/80'],
      ['textonly', 'hover:bg-accent']
    ] as const)('handles button variant: %s', ([variant, hoverClass]) => {
      const widget = createButtonWidget({ options: { variant } })
      mountComponent(widget)
      expect(screen.getByRole('button')).toHaveClass('bg-input', hoverClass)
    })
  })
})
