import { mount } from '@vue/test-utils'
import Button from 'primevue/button'
import type { ButtonProps } from 'primevue/button'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetButton from './WidgetButton.vue'

describe('WidgetButton Interactions', () => {
  const createMockWidget = (
    options: Partial<ButtonProps> = {},
    callback?: () => void
  ): SimplifiedWidget<void> => ({
    name: 'test_button',
    type: 'button',
    value: undefined,
    options,
    callback
  })

  const mountComponent = (widget: SimplifiedWidget<void>, readonly = false) => {
    return mount(WidgetButton, {
      global: {
        plugins: [PrimeVue],
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
      const widget = createMockWidget({}, mockCallback)
      const wrapper = mountComponent(widget)

      await clickButton(wrapper)

      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('does not call callback when button is readonly', async () => {
      const mockCallback = vi.fn()
      const widget = createMockWidget({}, mockCallback)
      const wrapper = mountComponent(widget, true)

      await clickButton(wrapper)

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('handles missing callback gracefully', async () => {
      const widget = createMockWidget({}, undefined)
      const wrapper = mountComponent(widget)

      // Should not throw error when clicking without callback
      await expect(clickButton(wrapper)).resolves.toBeDefined()
    })

    it('calls callback multiple times when clicked multiple times', async () => {
      const mockCallback = vi.fn()
      const widget = createMockWidget({}, mockCallback)
      const wrapper = mountComponent(widget)

      await clickButton(wrapper)
      await clickButton(wrapper)
      await clickButton(wrapper)

      expect(mockCallback).toHaveBeenCalledTimes(3)
    })
  })

  describe('Component Rendering', () => {
    it('renders button component', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.exists()).toBe(true)
    })

    it('renders widget label when name is provided', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget)

      const label = wrapper.find('label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toBe('test_button')
    })

    it('does not render label when widget name is empty', () => {
      const widget = createMockWidget()
      widget.name = ''
      const wrapper = mountComponent(widget)

      const label = wrapper.find('label')
      expect(label.exists()).toBe(false)
    })

    it('sets button size to small', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('size')).toBe('small')
    })

    it('passes widget options to button component', () => {
      const buttonOptions = {
        label: 'Custom Label',
        icon: 'pi pi-check',
        severity: 'success' as const
      }
      const widget = createMockWidget(buttonOptions)
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('label')).toBe('Custom Label')
      expect(button.props('icon')).toBe('pi pi-check')
      expect(button.props('severity')).toBe('success')
    })
  })

  describe('Readonly Mode', () => {
    it('disables button when readonly', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, true)

      // Test the actual DOM button element instead of the Vue component props
      const buttonElement = wrapper.find('button')
      expect(buttonElement.element.disabled).toBe(true)
    })

    it('enables button when not readonly', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget, false)

      // Test the actual DOM button element instead of the Vue component props
      const buttonElement = wrapper.find('button')
      expect(buttonElement.element.disabled).toBe(false)
    })
  })

  describe('Widget Options', () => {
    it('handles button with text only', () => {
      const widget = createMockWidget({ label: 'Click Me' })
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('label')).toBe('Click Me')
      expect(button.props('icon')).toBeNull()
    })

    it('handles button with icon only', () => {
      const widget = createMockWidget({ icon: 'pi pi-star' })
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('icon')).toBe('pi pi-star')
    })

    it('handles button with both text and icon', () => {
      const widget = createMockWidget({
        label: 'Save',
        icon: 'pi pi-save'
      })
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('label')).toBe('Save')
      expect(button.props('icon')).toBe('pi pi-save')
    })

    it('handles different button severities', () => {
      const severities = [
        'secondary',
        'success',
        'info',
        'warning',
        'danger',
        'help',
        'contrast'
      ] as const

      severities.forEach((severity) => {
        const widget = createMockWidget({ severity })
        const wrapper = mountComponent(widget)
        const button = wrapper.findComponent({ name: 'Button' })
        expect(button.props('severity')).toBe(severity)
      })
    })

    it('handles button variants', () => {
      const variants = ['outlined', 'text'] as const

      variants.forEach((variant) => {
        const widget = createMockWidget({ variant })
        const wrapper = mountComponent(widget)
        const button = wrapper.findComponent({ name: 'Button' })
        expect(button.props('variant')).toBe(variant)
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles widget with no options', () => {
      const widget = createMockWidget()
      const wrapper = mountComponent(widget)

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.exists()).toBe(true)
    })

    it('handles callback that throws error', async () => {
      const mockCallback = vi.fn(() => {
        throw new Error('Callback error')
      })
      const widget = createMockWidget({}, mockCallback)
      const wrapper = mountComponent(widget)

      // Should not break the component when callback throws
      await expect(clickButton(wrapper)).rejects.toThrow('Callback error')
      expect(mockCallback).toHaveBeenCalledTimes(1)
    })

    it('handles rapid consecutive clicks', async () => {
      const mockCallback = vi.fn()
      const widget = createMockWidget({}, mockCallback)
      const wrapper = mountComponent(widget)

      // Simulate rapid clicks
      const clickPromises = Array.from({ length: 5 }, () =>
        clickButton(wrapper)
      )
      await Promise.all(clickPromises)

      expect(mockCallback).toHaveBeenCalledTimes(5)
    })
  })
})
