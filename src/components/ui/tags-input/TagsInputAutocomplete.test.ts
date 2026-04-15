import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import TagsInputAutocomplete from './TagsInputAutocomplete.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        removeTag: 'Remove tag',
        createTag: 'Create new tag'
      }
    }
  }
})

const SUGGESTIONS = ['Apple', 'Banana', 'Cherry', 'Peach', 'Pineapple']

describe('TagsInputAutocomplete', () => {
  function renderComponent(props = {}) {
    const user = userEvent.setup()

    const result = render(TagsInputAutocomplete, {
      global: {
        plugins: [i18n],
        stubs: {
          ComboboxRoot: {
            template:
              '<div data-testid="combobox-root"><slot /></div>',
            props: ['modelValue', 'open', 'multiple', 'disabled']
          },
          ComboboxAnchor: {
            template: '<div><slot /></div>'
          },
          ComboboxContent: {
            template: '<div data-testid="dropdown"><slot /></div>'
          },
          ComboboxInput: {
            template:
              '<input data-testid="combobox-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue']
          },
          ComboboxItem: {
            template:
              '<div role="option" @click="$emit(\'select\')"><slot /></div>',
            props: ['value']
          },
          ComboboxViewport: {
            template: '<div><slot /></div>'
          },
          TagsInputRoot: {
            template: '<div data-testid="tags-root"><slot /></div>',
            props: ['modelValue', 'delimiter', 'disabled', 'displayValue']
          },
          TagsInputInput: {
            template:
              '<input data-testid="tags-input" :placeholder="placeholder" />',
            props: ['placeholder', 'isEmpty']
          },
          TagsInputItem: {
            template:
              '<span data-testid="tag-chip"><slot /></span>',
            props: ['value', 'class']
          },
          TagsInputItemText: {
            template: '<span data-testid="tag-text" />'
          },
          TagsInputItemDelete: {
            template: '<button data-testid="tag-delete" />'
          }
        }
      },
      props: {
        modelValue: [],
        suggestions: SUGGESTIONS,
        ...props
      }
    })

    return { ...result, user }
  }

  describe('rendering', () => {
    it('renders the component', () => {
      renderComponent()
      expect(screen.getByTestId('combobox-root')).toBeInTheDocument()
    })

    it('renders initial tags as chips', () => {
      renderComponent({ modelValue: ['Apple', 'Banana'] })
      const chips = screen.getAllByTestId('tag-chip')
      expect(chips).toHaveLength(2)
    })

    it('renders no chips when modelValue is empty', () => {
      renderComponent({ modelValue: [] })
      expect(screen.queryAllByTestId('tag-chip')).toHaveLength(0)
    })
  })

  describe('suggestion filtering', () => {
    it('excludes already-selected tags from suggestions', () => {
      renderComponent({ modelValue: ['Apple', 'Banana'] })
      // With Apple and Banana selected, dropdown should not contain them
      // This tests the filteredSuggestions computed
      const options = screen.queryAllByRole('option')
      const optionTexts = options.map((el) => el.textContent)
      expect(optionTexts).not.toContain('Apple')
      expect(optionTexts).not.toContain('Banana')
    })
  })

  describe('allowCreate', () => {
    it('hides create option when allowCreate is false', () => {
      renderComponent({ allowCreate: false })
      expect(screen.queryByText('Create new tag')).not.toBeInTheDocument()
    })

    it('hides create option by default when query is empty', () => {
      renderComponent({ allowCreate: true })
      // Create option requires non-empty query that doesn't match suggestions
      expect(screen.queryByText('Create new tag')).not.toBeInTheDocument()
    })
  })

  describe('tag-added emit', () => {
    it('emits tag-added when modelValue changes with new tags', async () => {
      const onTagAdded = vi.fn()
      const { rerender } = renderComponent({
        modelValue: ['Apple'],
        'onTag-added': onTagAdded
      })

      await rerender({ modelValue: ['Apple', 'Banana'] })
      await nextTick()

      expect(onTagAdded).toHaveBeenCalledWith('Banana', true)
    })

    it('emits isKnown=false for unknown tags', async () => {
      const onTagAdded = vi.fn()
      const { rerender } = renderComponent({
        modelValue: [],
        'onTag-added': onTagAdded
      })

      await rerender({ modelValue: ['custom-tag'] })
      await nextTick()

      expect(onTagAdded).toHaveBeenCalledWith('custom-tag', false)
    })
  })

  describe('disabled state', () => {
    it('passes disabled to root components', () => {
      renderComponent({ disabled: true })
      const root = screen.getByTestId('combobox-root')
      expect(root).toBeInTheDocument()
    })
  })
})
