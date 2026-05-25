import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SearchAutocomplete from './SearchAutocomplete.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { searchPlaceholder: 'Search...' } } }
})

describe('SearchAutocomplete', () => {
  function renderComponent(props: Record<string, unknown> = {}) {
    return render(SearchAutocomplete, {
      global: {
        plugins: [i18n],
        stubs: {
          ComboboxRoot: { template: '<div><slot /></div>' },
          ComboboxAnchor: { template: '<div><slot /></div>' },
          ComboboxInput: {
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue'],
            emits: ['update:modelValue']
          },
          ComboboxPortal: { template: '<div><slot /></div>' },
          ComboboxContent: { template: '<div><slot /></div>' },
          ComboboxItem: {
            template:
              '<button type="button" @click="$emit(\'select\', { preventDefault: () => {} })"><slot /></button>',
            emits: ['select']
          }
        }
      },
      props: { modelValue: '', ...props }
    })
  }

  describe('suggestions dropdown', () => {
    it('does not render items when suggestions list is empty', () => {
      renderComponent({ suggestions: [] })
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('renders a button for each suggestion', () => {
      renderComponent({ suggestions: ['foo', 'bar'] })
      expect(screen.getByText('foo')).toBeInTheDocument()
      expect(screen.getByText('bar')).toBeInTheDocument()
    })

    it('emits select with the suggestion when an item is clicked', async () => {
      const onSelect = vi.fn()
      const user = userEvent.setup()
      renderComponent({ suggestions: ['foo', 'bar'], onSelect })
      await user.click(screen.getByText('foo'))
      expect(onSelect).toHaveBeenCalledWith('foo')
    })

    it('updates modelValue to the suggestion label on selection', async () => {
      const onUpdateModelValue = vi.fn()
      const user = userEvent.setup()
      renderComponent({
        suggestions: ['foo', 'bar'],
        'onUpdate:modelValue': onUpdateModelValue
      })
      await user.click(screen.getByText('foo'))
      expect(onUpdateModelValue).toHaveBeenCalledWith('foo')
    })
  })

  describe('with optionLabel', () => {
    it('displays the optionLabel property as the suggestion text', () => {
      const suggestions = [{ id: 1, query: 'my-extension' }]
      renderComponent({ suggestions, optionLabel: 'query' })
      expect(screen.getByText('my-extension')).toBeInTheDocument()
    })

    it('emits the full item object on selection when optionLabel is set', async () => {
      const onSelect = vi.fn()
      const user = userEvent.setup()
      const suggestions = [{ id: 1, query: 'my-extension' }]
      renderComponent({ suggestions, optionLabel: 'query', onSelect })
      await user.click(screen.getByText('my-extension'))
      expect(onSelect).toHaveBeenCalledWith({ id: 1, query: 'my-extension' })
    })
  })
})
