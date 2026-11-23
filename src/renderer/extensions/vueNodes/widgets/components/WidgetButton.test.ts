import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import WidgetButton from '@/renderer/extensions/vueNodes/widgets/components/WidgetButton.vue'
import { app } from '@/scripts/app'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

import { registerTestWidget } from './widgetTestUtils'

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
    overrides: {
      name?: string
      label?: string
      options?: ButtonWidgetOptions
    } = {}
  ) => registerTestWidget({ ...BUTTON_DEFAULTS, ...overrides })

  const createButtonWidgetWithCallback = (callback: () => void) => {
    const graph = new LGraph()
    vi.mocked(app).rootGraph = graph
    const node = new LGraphNode('Host')
    node.addWidget('button', BUTTON_DEFAULTS.name, undefined, callback)
    graph.add(node)
    return widgetId(graph.id, node.id, BUTTON_DEFAULTS.name)
  }

  const mountComponent = (widgetId: WidgetId) => {
    const user = userEvent.setup()
    const result = render(WidgetButton, {
      props: {
        widgetId
      }
    })
    return { ...result, user }
  }

  const clickButton = async (user: ReturnType<typeof userEvent.setup>) => {
    const button = screen.getByRole('button')
    await user.click(button)
    return button
  }

  describe('Click Handling', () => {
    it('calls callback when button is clicked', async () => {
      const mockCallback = vi.fn()
      const widget = createButtonWidgetWithCallback(mockCallback)
      const { user } = mountComponent(widget)

      await clickButton(user)

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('keeps the value an extension stores on the button', async () => {
      const graph = new LGraph()
      vi.mocked(app).rootGraph = graph
      const node = new LGraphNode('Host')
      const received: unknown[] = []
      const button = node.addWidget(
        'button',
        BUTTON_DEFAULTS.name,
        'armed',
        (value) => received.push(value)
      )
      graph.add(node)
      const { user } = mountComponent(
        widgetId(graph.id, node.id, BUTTON_DEFAULTS.name)
      )

      await clickButton(user)

      expect(received).toEqual(['armed'])
      expect(button.value).toBe('armed')
    })

    it('calls callback multiple times when clicked multiple times', async () => {
      const mockCallback = vi.fn()
      const widget = createButtonWidgetWithCallback(mockCallback)
      const { user } = mountComponent(widget)

      const numClicks = 8

      for (let i = 0; i < numClicks; i++) {
        await clickButton(user)
      }

      expect(mockCallback).toHaveBeenCalledTimes(numClicks)
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

  describe('Edge Cases', () => {
    it('handles callback that throws error', async () => {
      const mockCallback = vi.fn(() => {
        throw new Error('Callback error')
      })
      const widget = createButtonWidgetWithCallback(mockCallback)
      const { user } = mountComponent(widget)

      await expect(clickButton(user)).rejects.toThrow('Callback error')
      expect(mockCallback).toHaveBeenCalledTimes(1)
    })
  })
})
