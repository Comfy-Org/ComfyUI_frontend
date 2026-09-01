import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import WidgetButton from '@/renderer/extensions/vueNodes/widgets/components/WidgetButton.vue'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import { createMockWidget } from './widgetTestUtils'

type ButtonWidgetOptions = IWidgetOptions & {
  variant?: string
  label?: string
}

const BUTTON_DEFAULTS = {
  value: undefined,
  type: 'button',
  name: 'test_button'
} as const

const ButtonStub = {
  name: 'Button',
  props: ['size', 'variant', 'disabled'],
  template:
    '<button :data-size="size" :data-variant="variant" :disabled="disabled"><slot /></button>'
}

describe('WidgetButton Interactions', () => {
  const createButtonWidget = (
    overrides: Partial<SimplifiedWidget<void, ButtonWidgetOptions>> = {}
  ) => createMockWidget<void>({ ...BUTTON_DEFAULTS, ...overrides })

  const mountComponent = (widget: SimplifiedWidget<void>) => {
    const user = userEvent.setup()
    const result = render(WidgetButton, {
      global: {
        stubs: {
          Button: ButtonStub
        }
      },
      props: {
        widget
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
      const widget = createButtonWidget({ callback: mockCallback })
      const { user } = mountComponent(widget)

      await clickButton(user)

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('handles missing callback gracefully', async () => {
      const widget = createButtonWidget()
      const { user } = mountComponent(widget)

      await expect(clickButton(user)).resolves.toBeDefined()
    })

    it('calls callback multiple times when clicked multiple times', async () => {
      const mockCallback = vi.fn()
      const widget = createButtonWidget({ callback: mockCallback })
      const { user } = mountComponent(widget)

      const numClicks = 8

      for (let i = 0; i < numClicks; i++) {
        await clickButton(user)
      }

      expect(mockCallback).toHaveBeenCalledTimes(numClicks)
    })
  })

  describe('Component Rendering', () => {
    it('renders button component', () => {
      const widget = createButtonWidget()
      mountComponent(widget)

      expect(screen.getByRole('button')).toBeDefined()
    })

    it('renders widget text when name is provided', () => {
      const widget = createButtonWidget()
      mountComponent(widget)

      expect(screen.getByRole('button')).toHaveTextContent('test_button')
    })

    it('sets button size to sm', () => {
      const widget = createButtonWidget()
      mountComponent(widget)

      expect(screen.getByRole('button').getAttribute('data-size')).toBe('sm')
    })

    it('passes widget options to button component', () => {
      const widget = createButtonWidget({
        options: { variant: 'secondary' }
      })
      mountComponent(widget)

      expect(screen.getByRole('button').getAttribute('data-variant')).toBe(
        'secondary'
      )
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

      // eslint-disable-next-line testing-library/no-node-access
      expect(container.querySelector('i.pi.pi-star')).not.toBeNull()
    })

    it('handles button with both label and iconClass', () => {
      const widget = createButtonWidget({
        label: 'Save',
        options: { iconClass: 'pi pi-save' }
      })
      const { container } = mountComponent(widget)

      expect(screen.getByRole('button')).toHaveTextContent('Save')
      // eslint-disable-next-line testing-library/no-node-access
      expect(container.querySelector('i.pi.pi-save')).not.toBeNull()
    })

    it.for(['secondary', 'primary', 'inverted', 'textonly'] as const)(
      'handles button variant: %s',
      (variant) => {
        const widget = createButtonWidget({ options: { variant } })
        mountComponent(widget)
        expect(screen.getByRole('button').getAttribute('data-variant')).toBe(
          variant
        )
      }
    )
  })

  describe('Edge Cases', () => {
    it('handles widget with no options', () => {
      const widget = createButtonWidget()
      mountComponent(widget)

      expect(screen.getByRole('button')).toBeDefined()
    })

    it('handles callback that throws error', async () => {
      const mockCallback = vi.fn(() => {
        throw new Error('Callback error')
      })
      const widget = createButtonWidget({ callback: mockCallback })
      const { user } = mountComponent(widget)

      await expect(clickButton(user)).rejects.toThrow('Callback error')
      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('handles rapid consecutive clicks', async () => {
      const mockCallback = vi.fn()
      const widget = createButtonWidget({ callback: mockCallback })
      const { user } = mountComponent(widget)

      for (let i = 0; i < 16; i++) {
        await clickButton(user)
      }

      expect(mockCallback).toHaveBeenCalledTimes(16)
    })
  })
})
