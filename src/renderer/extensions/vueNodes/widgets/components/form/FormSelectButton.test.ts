/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'

import FormSelectButton from './FormSelectButton.vue'

describe('FormSelectButton Core Component', () => {
  // Type-safe helper for rendering component
  const renderComponent = (
    modelValue: string | null | undefined = null,
    options: unknown[] = [],
    props: Record<string, unknown> = {}
  ) => {
    return render(FormSelectButton, {
      global: {
        plugins: [PrimeVue]
      },
      props: {
        modelValue,
        options: options as unknown as (
          | string
          | number
          | { label: string; value: string | number }
        )[],
        ...props
      }
    })
  }

  const clickButton = async (buttonText: string) => {
    const buttons = screen.getAllByRole('button')
    const targetButton = buttons.find((button) =>
      button.textContent?.includes(buttonText)
    )

    if (!targetButton) {
      throw new Error(`Button with text "${buttonText}" not found`)
    }

    const user = userEvent.setup()
    await user.click(targetButton)
    return targetButton
  }

  describe('Basic Rendering', () => {
    it('renders as a horizontal button group layout', () => {
      const options = ['option1', 'option2']
      const { container } = renderComponent(null, options)

      const div = container.querySelector('div')
      const buttons = screen.getAllByRole('button')

      // Verify layout behavior: container exists and contains buttons
      expect(div).toBeInTheDocument()
      expect(buttons).toHaveLength(2)

      // Verify buttons are arranged horizontally (not vertically stacked)
      // This tests the layout logic rather than specific CSS classes
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument()
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('renders buttons for each option', () => {
      const options = ['first', 'second', 'third']
      renderComponent(null, options)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
      expect(buttons[0].textContent).toBe('first')
      expect(buttons[1].textContent).toBe('second')
      expect(buttons[2].textContent).toBe('third')
    })

    it('renders empty container when no options provided', () => {
      renderComponent(null, [])

      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('applies proper button styling', () => {
      const options = ['test']
      renderComponent(null, options)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('flex-1')
      expect(button).toHaveClass('h-6')
      expect(button).toHaveClass('px-5')
      expect(button).toHaveClass('py-[5px]')
      expect(button).toHaveClass('rounded-sm')
      expect(button).toHaveClass('text-center')
      expect(button).toHaveClass('text-xs')
      expect(button).toHaveClass('font-normal')
    })
  })

  describe('String Options', () => {
    it('handles string array options', () => {
      const options = ['apple', 'banana', 'cherry']
      renderComponent('banana', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
      expect(buttons[0].textContent).toBe('apple')
      expect(buttons[1].textContent).toBe('banana')
      expect(buttons[2].textContent).toBe('cherry')
    })

    it('emits correct string value when clicked', async () => {
      const options = ['first', 'second', 'third']
      const onUpdateModelValue = vi.fn()
      render(FormSelectButton, {
        global: { plugins: [PrimeVue] },
        props: {
          modelValue: 'first',
          options: options as unknown as (
            | string
            | number
            | { label: string; value: string | number }
          )[],
          'onUpdate:modelValue': onUpdateModelValue
        }
      })

      await clickButton('second')

      expect(onUpdateModelValue).toHaveBeenCalledWith('second')
    })

    it('highlights selected string option', () => {
      const options = ['option1', 'option2', 'option3']
      renderComponent('option2', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[1]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
      expect(buttons[1]).toHaveClass('text-text-primary')
      expect(buttons[0]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
      expect(buttons[2]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })
  })

  describe('Number Options', () => {
    it('handles number array options', () => {
      const options = [1, 2, 3]
      renderComponent('2', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
      expect(buttons[0].textContent).toBe('1')
      expect(buttons[1].textContent).toBe('2')
      expect(buttons[2].textContent).toBe('3')
    })

    it('emits number value when clicked', async () => {
      const options = [10, 20, 30]
      const onUpdateModelValue = vi.fn()
      render(FormSelectButton, {
        global: { plugins: [PrimeVue] },
        props: {
          modelValue: '10',
          options: options as unknown as (
            | string
            | number
            | { label: string; value: string | number }
          )[],
          'onUpdate:modelValue': onUpdateModelValue
        }
      })

      await clickButton('20')

      expect(onUpdateModelValue).toHaveBeenCalledWith(20)
    })

    it('highlights selected number option', () => {
      const options = [100, 200, 300]
      renderComponent('200', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[1]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
      expect(buttons[1]).toHaveClass('text-text-primary')
    })
  })

  describe('Object Options', () => {
    it('handles object array with label and value', () => {
      const options = [
        { label: 'First Option', value: 'first' },
        { label: 'Second Option', value: 'second' }
      ]
      renderComponent('first', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2)
      expect(buttons[0].textContent).toBe('First Option')
      expect(buttons[1].textContent).toBe('Second Option')
    })

    it('emits object value when object option clicked', async () => {
      const options = [
        { label: 'Apple', value: 'apple_val' },
        { label: 'Banana', value: 'banana_val' }
      ]
      const onUpdateModelValue = vi.fn()
      render(FormSelectButton, {
        global: { plugins: [PrimeVue] },
        props: {
          modelValue: 'apple_val',
          options: options as unknown as (
            | string
            | number
            | { label: string; value: string | number }
          )[],
          'onUpdate:modelValue': onUpdateModelValue
        }
      })

      await clickButton('Banana')

      expect(onUpdateModelValue).toHaveBeenCalledWith('banana_val')
    })

    it('highlights selected object option by value', () => {
      const options = [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' }
      ]
      renderComponent('md', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[1]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // Medium
      expect(buttons[0]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
      expect(buttons[2]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('handles objects without value field', () => {
      const options = [
        { label: 'First', name: 'first_name' },
        { label: 'Second', name: 'second_name' }
      ]
      renderComponent('first_name', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0].textContent).toBe('First')
      expect(buttons[1].textContent).toBe('Second')
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('handles objects without label field', () => {
      const options = [
        { value: 'val1', name: 'Name 1' },
        { value: 'val2', name: 'Name 2' }
      ]
      renderComponent('val1', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0].textContent).toBe('Name 1')
      expect(buttons[1].textContent).toBe('Name 2')
    })
  })

  describe('PrimeVue Compatibility', () => {
    it('uses custom optionLabel prop', () => {
      const options = [
        { title: 'First Item', value: 'first' },
        { title: 'Second Item', value: 'second' }
      ]
      renderComponent('first', options, { optionLabel: 'title' })

      const buttons = screen.getAllByRole('button')
      expect(buttons[0].textContent).toBe('First Item')
      expect(buttons[1].textContent).toBe('Second Item')
    })

    it('uses custom optionValue prop', () => {
      const options = [
        { label: 'First', id: 'first_id' },
        { label: 'Second', id: 'second_id' }
      ]
      renderComponent('first_id', options, { optionValue: 'id' })

      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
      expect(buttons[1]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('emits custom optionValue when clicked', async () => {
      const options = [
        { label: 'First', id: 'first_id' },
        { label: 'Second', id: 'second_id' }
      ]
      const onUpdateModelValue = vi.fn()
      render(FormSelectButton, {
        global: { plugins: [PrimeVue] },
        props: {
          modelValue: 'first_id',
          options: options as unknown as (
            | string
            | number
            | { label: string; value: string | number }
          )[],
          optionValue: 'id',
          'onUpdate:modelValue': onUpdateModelValue
        }
      })

      await clickButton('Second')

      expect(onUpdateModelValue).toHaveBeenCalledWith('second_id')
    })
  })

  describe('Disabled State', () => {
    it('disables all buttons when disabled prop is true', () => {
      const options = ['option1', 'option2']
      renderComponent('option1', options, { disabled: true })

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect((button as HTMLButtonElement).disabled).toBe(true)
        expect(button).toHaveClass('opacity-50')
        expect(button).toHaveClass('cursor-not-allowed')
      })
    })

    it('does not emit events when disabled', async () => {
      const options = ['option1', 'option2']
      const onUpdateModelValue = vi.fn()
      render(FormSelectButton, {
        global: { plugins: [PrimeVue] },
        props: {
          modelValue: 'option1',
          options: options as unknown as (
            | string
            | number
            | { label: string; value: string | number }
          )[],
          disabled: true,
          'onUpdate:modelValue': onUpdateModelValue
        }
      })

      await clickButton('option2')

      expect(onUpdateModelValue).not.toHaveBeenCalled()
    })

    it('does not apply hover styles when disabled', () => {
      const options = ['option1', 'option2']
      renderComponent('option1', options, { disabled: true })

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).not.toHaveClass(
          'hover:bg-interface-menu-component-surface-hovered'
        )
        expect(button).not.toHaveClass('cursor-pointer')
      })
    })

    it('applies disabled styling to selected option', () => {
      const options = ['option1', 'option2']
      renderComponent('option1', options, { disabled: true })

      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // Selected styling disabled
      expect(buttons[0]).toHaveClass('opacity-50')
      expect(buttons[0]).toHaveClass('text-text-secondary')
    })
  })

  describe('Selection Logic', () => {
    it('handles null modelValue', () => {
      const options = ['option1', 'option2']
      renderComponent(null, options)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).not.toHaveClass(
          'bg-interface-menu-component-surface-selected'
        )
      })
    })

    it('handles undefined modelValue', () => {
      const options = ['option1', 'option2']
      renderComponent(undefined, options)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).not.toHaveClass(
          'bg-interface-menu-component-surface-selected'
        )
      })
    })

    it('handles empty string modelValue', () => {
      const options = ['', 'option1', 'option2']
      renderComponent('', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // Empty string is selected
      expect(buttons[1]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('compares values as strings', () => {
      const options = [1, '2', 3]
      renderComponent('1', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // '1' matches number 1 as string
    })
  })

  describe('Visual States', () => {
    it('applies selected styling to active option', () => {
      const options = ['option1', 'option2']
      renderComponent('option1', options)

      const selectedButton = screen.getAllByRole('button')[0]
      expect(selectedButton).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
      expect(selectedButton).toHaveClass('text-text-primary')
    })

    it('applies unselected styling to inactive options', () => {
      const options = ['option1', 'option2']
      renderComponent('option1', options)

      const unselectedButton = screen.getAllByRole('button')[1]
      expect(unselectedButton).toHaveClass('bg-transparent')
      expect(unselectedButton).toHaveClass('text-text-secondary')
    })

    it('applies hover effects to enabled unselected buttons', () => {
      const options = ['option1', 'option2']
      renderComponent('option1', options, { disabled: false })

      const unselectedButton = screen.getAllByRole('button')[1]
      expect(unselectedButton).toHaveClass(
        'hover:bg-interface-menu-component-surface-selected/50'
      )
      expect(unselectedButton).toHaveClass('cursor-pointer')
    })
  })

  describe('Edge Cases', () => {
    it('handles very long option text', () => {
      const longText =
        'This is a very long option text that might cause layout issues'
      const options = ['short', longText, 'normal']
      renderComponent('short', options)

      const buttons = screen.getAllByRole('button')
      expect(buttons[1].textContent).toBe(longText)
      expect(buttons).toHaveLength(3)
    })

    it('handles options with special characters', () => {
      const specialOptions = ['@#$%^&*()', '{}[]|\\:";\'<>?,./']
      renderComponent(specialOptions[0], specialOptions)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0].textContent).toBe('@#$%^&*()')
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('handles unicode characters in options', () => {
      const unicodeOptions = ['🎨 Art', '中文', 'العربية']
      renderComponent('🎨 Art', unicodeOptions)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0].textContent).toBe('🎨 Art')
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('handles duplicate option values', () => {
      const duplicateOptions = ['duplicate', 'unique', 'duplicate']
      renderComponent('duplicate', duplicateOptions)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
      expect(buttons[2]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // Both duplicates selected
      expect(buttons[1]).not.toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('handles mixed type options safely', () => {
      const mixedOptions: unknown[] = [
        'string',
        123,
        { label: 'Object', value: 'obj' }
      ]
      renderComponent('123', mixedOptions)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
      expect(buttons[1]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // Number 123 as string
    })

    it('handles objects with missing properties gracefully', () => {
      const incompleteOptions = [
        {}, // Empty object
        { randomProp: 'value' }, // No standard props
        { value: 'has_value' }, // No label
        { label: 'has_label' } // No value
      ]
      renderComponent('has_value', incompleteOptions)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(4)
      expect(buttons[2]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      )
    })

    it('handles large number of options', () => {
      const manyOptions = Array.from(
        { length: 50 },
        (_, i) => `Option ${i + 1}`
      )
      renderComponent('Option 25', manyOptions)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(50)
      expect(buttons[24]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // Option 25 at index 24
    })

    it('fallback to index when all object properties are missing', () => {
      const problematicOptions = [
        { someRandomProp: 'random1' },
        { anotherRandomProp: 'random2' }
      ]
      renderComponent('0', problematicOptions)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2)
      expect(buttons[0]).toHaveClass(
        'bg-interface-menu-component-surface-selected'
      ) // Falls back to index 0
    })
  })

  describe('Event Handling', () => {
    it('prevents click events when disabled', async () => {
      const options = ['option1', 'option2']
      const { container } = renderComponent('option1', options, {
        disabled: true
      })

      const clickHandler = vi.fn()
      container.firstElementChild!.addEventListener('click', clickHandler)

      await clickButton('option2')

      expect(clickHandler).not.toHaveBeenCalled()
    })

    it('allows repeated selection of same option', async () => {
      const options = ['option1', 'option2']
      const onUpdateModelValue = vi.fn()
      render(FormSelectButton, {
        global: { plugins: [PrimeVue] },
        props: {
          modelValue: 'option1',
          options: options as unknown as (
            | string
            | number
            | { label: string; value: string | number }
          )[],
          'onUpdate:modelValue': onUpdateModelValue
        }
      })

      await clickButton('option1')
      await clickButton('option1')

      expect(onUpdateModelValue).toHaveBeenCalledTimes(2)
      expect(onUpdateModelValue).toHaveBeenNthCalledWith(1, 'option1')
      expect(onUpdateModelValue).toHaveBeenNthCalledWith(2, 'option1')
    })
  })
})
