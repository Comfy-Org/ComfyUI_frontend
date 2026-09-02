import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import type { SettingOption } from '@/platform/settings/types'

import FormRadioGroup from './FormRadioGroup.vue'

type FormRadioGroupProps = ComponentProps<typeof FormRadioGroup>

describe('FormRadioGroup', () => {
  function renderComponent(props: FormRadioGroupProps) {
    return render(FormRadioGroup, {
      global: { plugins: [PrimeVue] },
      props
    })
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

    it('handles custom object with optionLabel and optionValue', () => {
      renderComponent({
        modelValue: 2,
        options: [
          { name: 'First Option', id: '1' },
          { name: 'Second Option', id: '2' },
          { name: 'Third Option', id: '3' }
        ],
        optionLabel: 'name',
        optionValue: 'id',
        id: 'test-radio'
      })

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)

      expect(radios[0]).toHaveAttribute('value', '1')
      expect(radios[1]).toHaveAttribute('value', '2')
      expect(radios[2]).toHaveAttribute('value', '3')

      expect(screen.getByText('First Option')).toBeInTheDocument()
      expect(screen.getByText('Second Option')).toBeInTheDocument()
      expect(screen.getByText('Third Option')).toBeInTheDocument()
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

    it('handles object with missing properties gracefully', () => {
      renderComponent({
        modelValue: 'opt1',
        options: [{ label: 'Option 1', val: 'opt1' }],
        id: 'test-radio'
      })

      expect(screen.getAllByRole('radio')).toHaveLength(1)
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('component functionality', () => {
    it('sets correct id and name attributes on inputs', () => {
      renderComponent({
        modelValue: 'A',
        options: ['A', 'B'],
        id: 'my-radio-group'
      })

      const radios = screen.getAllByRole('radio')

      expect(radios[0]).toHaveAttribute('id', 'my-radio-group-A')
      expect(radios[0]).toHaveAttribute('name', 'my-radio-group')
      expect(radios[1]).toHaveAttribute('id', 'my-radio-group-B')
      expect(radios[1]).toHaveAttribute('name', 'my-radio-group')
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
      // PrimeVue RadioButton places aria-describedby on its root <div>, not the <input>
      // eslint-disable-next-line testing-library/no-node-access
      expect(radios[0].closest('[aria-describedby]')).toHaveAttribute(
        'aria-describedby',
        'Option 1-label'
      )
      // eslint-disable-next-line testing-library/no-node-access
      expect(radios[1].closest('[aria-describedby]')).toHaveAttribute(
        'aria-describedby',
        'Option 2-label'
      )
    })
  })
})
