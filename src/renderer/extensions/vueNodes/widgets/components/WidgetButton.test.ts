import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import Button from '@/components/ui/button/Button.vue'
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

describe('WidgetButton Interactions', () => {
  const createButtonWidget = (
    overrides: Partial<SimplifiedWidget<void, ButtonWidgetOptions>> = {}
  ) => createMockWidget<void>({ ...BUTTON_DEFAULTS, ...overrides })

  const mountComponent = (widget: SimplifiedWidget<void>, readonly = false) => {
    return mount(WidgetButton, {
      global: {
        components: { Button }
      },
      props: {
        widget,
        readonly
      }
    })
  }

  const clickButton = async (wrapper: ReturnType<typeof mount>) => {
    const button = wrapper.findComponent({ name: 'Button' })
    await button.trigger('click')
    return button
  }

  describe('Click Handling', () => {
    it('calls callback when button is clicked', async () => {
      const mockCallback = vi.fn()
      const widget = createButtonWidget({ callback: mockCallback })
      const wrapper = mountComponent(widget)

      await clickButton(wrapper)

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('handles missing callback gracefully', async () => {
      const widget = createButtonWidget()
      const wrapper = mountComponent(widget)

      // Should not throw error when clicking without callback
      await expect(clickButton(wrapper)).resolves.toBeDefined()
    })

    it('calls callback multiple times when clicked multiple times', async () => {
      const mockCallback = vi.fn()
      const widget = createButtonWidget({ callback: mockCallback })
      const wrapper = mountComponent(widget)

      const numClicks = 8

      for (let i = 0; i < numClicks; i++) {
        await clickButton(wrapper)
      }

      expect(mockCallback).toHaveBeenCalledTimes(numClicks)
    })
  })

  describe('Component Rendering', () => {
    it('renders button component', () => {
      const widget = createButtonWidget()
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.exists()).toBe(true)
    })

    it('renders widget text when name is provided', () => {
      const widget = createButtonWidget()
      const wrapper = mountComponent(widget)

      expect(wrapper.text()).toBe('test_button')
    })

    it('sets button size to sm', () => {
      const widget = createButtonWidget()
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('size')).toBe('sm')
    })

    it('passes widget options to button component', () => {
      const widget = createButtonWidget({
        options: { variant: 'secondary' }
      })
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('variant')).toBe('secondary')
    })
  })

  describe('Widget Options', () => {
    it('handles button with label', () => {
      const widget = createButtonWidget({
        name: 'btn',
        label: 'Click Me',
        options: { label: 'Click Me' }
      })
      const wrapper = mountComponent(widget)

      expect(wrapper.text()).toBe('Click Me')
    })

    it('handles button with iconClass', () => {
      const widget = createButtonWidget({
        options: { iconClass: 'pi pi-star' }
      })
      const wrapper = mountComponent(widget)

      const icon = wrapper.find('i.pi.pi-star')
      expect(icon.exists()).toBe(true)
    })

    it('handles button with both label and iconClass', () => {
      const widget = createButtonWidget({
        label: 'Save',
        options: { iconClass: 'pi pi-save' }
      })
      const wrapper = mountComponent(widget)

      expect(wrapper.text()).toBe('Save')
      const icon = wrapper.find('i.pi.pi-save')
      expect(icon.exists()).toBe(true)
    })

    it.for(['secondary', 'primary', 'inverted', 'textonly'] as const)(
      'handles button variant: %s',
      (variant) => {
        const widget = createButtonWidget({ options: { variant } })
        const wrapper = mountComponent(widget)
        const button = wrapper.findComponent({ name: 'Button' })
        expect(button.props('variant')).toBe(variant)
      }
    )
  })

  describe('Edge Cases', () => {
    it('handles widget with no options', () => {
      const widget = createButtonWidget()
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.exists()).toBe(true)
    })

    it('handles callback that throws error', async () => {
      const mockCallback = vi.fn(() => {
        throw new Error('Callback error')
      })
      const widget = createButtonWidget({ callback: mockCallback })
      const wrapper = mountComponent(widget)

      // Should not break the component when callback throws
      await expect(clickButton(wrapper)).rejects.toThrow('Callback error')
      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('handles rapid consecutive clicks', async () => {
      const mockCallback = vi.fn()
      const widget = createButtonWidget({ callback: mockCallback })
      const wrapper = mountComponent(widget)

      // Simulate rapid clicks
      const clickPromises = Array.from({ length: 16 }, () =>
        clickButton(wrapper)
      )
      await Promise.all(clickPromises)

      expect(mockCallback).toHaveBeenCalledTimes(16)
    })
  })
})
