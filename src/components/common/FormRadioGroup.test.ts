import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import type { SettingOption } from '@/platform/settings/types'

import FormRadioGroup from './FormRadioGroup.vue'

type FormRadioGroupProps = ComponentProps<typeof FormRadioGroup>

describe('FormRadioGroup', () => {
  function renderComponent(props: FormRadioGroupProps) {
    return render(FormRadioGroup, { props })
  }

  describe('normalizedOptions computed property', () => {
    it('handles string array options', () => {
      renderComponent({
        modelValue: 'option1',
        options: ['option1', 'option2', 'option3'],
        id: 'test-radio'
      })

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)

      expect(radios[0]).toHaveAttribute('value', 'option1')
      expect(radios[1]).toHaveAttribute('value', 'option2')
      expect(radios[2]).toHaveAttribute('value', 'option3')

      expect(screen.getByText('option1')).toBeInTheDocument()
      expect(screen.getByText('option2')).toBeInTheDocument()
      expect(screen.getByText('option3')).toBeInTheDocument()
    })

    it('handles SettingOption array', () => {
      renderComponent({
        modelValue: 'md',
        options: [
          { text: 'Small', value: 'sm' },
          { text: 'Medium', value: 'md' },
          { text: 'Large', value: 'lg' }
        ] satisfies SettingOption[],
        id: 'test-radio'
      })

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)

      expect(radios[0]).toHaveAttribute('value', 'sm')
      expect(radios[1]).toHaveAttribute('value', 'md')
      expect(radios[2]).toHaveAttribute('value', 'lg')

      expect(screen.getByText('Small')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Large')).toBeInTheDocument()
    })

    it('handles SettingOption with undefined value (uses text as value)', () => {
      renderComponent({
        modelValue: 'Option A',
        options: [
          { text: 'Option A', value: undefined },
          { text: 'Option B' }
        ] satisfies SettingOption[],
        id: 'test-radio'
      })

      const radios = screen.getAllByRole('radio')
      expect(radios[0]).toHaveAttribute('value', 'Option A')
      expect(radios[1]).toHaveAttribute('value', 'Option B')
    })

    it('handles mixed array with strings and SettingOptions', () => {
      renderComponent({
        modelValue: 'complex',
        options: [
          'Simple String',
          { text: 'Complex Option', value: 'complex' },
          'Another String'
        ] as (string | SettingOption)[],
        id: 'test-radio'
      })

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)

      expect(radios[0]).toHaveAttribute('value', 'Simple String')
      expect(radios[1]).toHaveAttribute('value', 'complex')
      expect(radios[2]).toHaveAttribute('value', 'Another String')

      expect(screen.getByText('Simple String')).toBeInTheDocument()
      expect(screen.getByText('Complex Option')).toBeInTheDocument()
      expect(screen.getByText('Another String')).toBeInTheDocument()
    })

    it('handles empty options array', () => {
      renderComponent({
        modelValue: null,
        options: [],
        id: 'test-radio'
      })

      expect(screen.queryAllByRole('radio')).toHaveLength(0)
    })

    it('handles undefined options gracefully', () => {
      renderComponent({
        modelValue: null,
        options: undefined,
        id: 'test-radio'
      })

      expect(screen.queryAllByRole('radio')).toHaveLength(0)
    })
  })

  describe('component functionality', () => {
    it('renders and updates the selected option', async () => {
      const user = userEvent.setup()
      const { emitted } = renderComponent({
        modelValue: 'A',
        options: ['A', 'B'],
        id: 'selection'
      })

      expect(screen.getByRole('radio', { name: 'A' })).toBeChecked()

      await user.click(screen.getByRole('radio', { name: 'B' }))
      expect(emitted()['update:modelValue']).toEqual([['B']])
    })

    it('keeps numeric option values numeric', async () => {
      const user = userEvent.setup()
      const { emitted } = renderComponent({
        modelValue: 1,
        options: [
          { text: 'One', value: 1 },
          { text: 'Two', value: 2 }
        ] satisfies SettingOption[],
        id: 'count'
      })

      expect(screen.getByRole('radio', { name: 'One' })).toBeChecked()

      await user.click(screen.getByRole('radio', { name: 'Two' }))
      expect(emitted()['update:modelValue']).toEqual([[2]])
    })

    it('sets ids on radio buttons', () => {
      renderComponent({
        modelValue: 'A',
        options: ['A', 'B'],
        id: 'my-radio-group'
      })

      const radios = screen.getAllByRole('radio')

      expect(radios[0]).toHaveAttribute('id', 'my-radio-group-A')
      expect(radios[1]).toHaveAttribute('id', 'my-radio-group-B')
    })

    it('associates labels with radio buttons correctly', () => {
      renderComponent({
        modelValue: 'Yes',
        options: ['Yes', 'No'],
        id: 'confirm-radio'
      })

      expect(screen.getByText('Yes')).toHaveAttribute(
        'for',
        'confirm-radio-Yes'
      )
      expect(screen.getByText('No')).toHaveAttribute('for', 'confirm-radio-No')
    })

    it('sets aria-describedby attribute correctly', () => {
      renderComponent({
        modelValue: 'opt1',
        options: [
          { text: 'Option 1', value: 'opt1' },
          { text: 'Option 2', value: 'opt2' }
        ] satisfies SettingOption[],
        id: 'test-radio'
      })

      const radios = screen.getAllByRole('radio')
      expect(radios[0]).toHaveAttribute('aria-describedby', 'Option 1-label')
      expect(radios[1]).toHaveAttribute('aria-describedby', 'Option 2-label')
    })
  })
})
