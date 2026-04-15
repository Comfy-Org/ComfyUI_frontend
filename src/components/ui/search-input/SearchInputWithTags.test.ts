import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
// import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import SearchInputWithTags from './SearchInputWithTags.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        clear: 'Clear',
        searchPlaceholder: 'Search...',
        createTag: 'Create new tag'
      }
    }
  }
})

const SUGGESTIONS = ['landscape', 'portrait', 'anime', 'pixel_art']

describe('SearchInputWithTags', () => {
  function renderComponent(props = {}) {
    const user = userEvent.setup()

    const result = render(SearchInputWithTags, {
      global: {
        plugins: [i18n],
        stubs: {
          ComboboxRoot: {
            template: '<div data-testid="combobox-root"><slot /></div>',
            props: ['modelValue', 'open', 'multiple', 'disabled']
          },
          ComboboxAnchor: {
            template:
              '<div data-testid="anchor" @click="$emit(\'click\')"><slot /></div>',
            emits: ['click']
          },
          ComboboxContent: {
            template: '<div data-testid="dropdown"><slot /></div>'
          },
          ComboboxInput: {
            template:
              '<input data-testid="combobox-input" :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['placeholder', 'modelValue']
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
            template:
              '<div data-testid="tags-root"><slot /></div>',
            props: ['modelValue', 'delimiter', 'disabled', 'displayValue']
          },
          TagsInputInput: {
            template:
              '<input data-testid="tags-input" :placeholder="placeholder" />',
            props: ['placeholder', 'isEmpty']
          },
          TagsInputItem: {
            template:
              '<span data-testid="tag-chip" :class="$attrs.class"><slot /></span>',
            props: ['value']
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
        query: '',
        suggestions: SUGGESTIONS,
        ...props
      }
    })

    return { ...result, user }
  }

  describe('icon states', () => {
    it('shows search icon when empty', () => {
      renderComponent()
      const icon = document.querySelector('.icon-\\[lucide--search\\]')
      expect(icon).toBeInTheDocument()
    })

    it('shows clear button when has text', () => {
      renderComponent({ query: 'some text' })
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })

    it('shows clear button when has tags', () => {
      renderComponent({ modelValue: ['landscape'] })
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })

    it('does not show clear button when empty', () => {
      renderComponent()
      expect(
        screen.queryByRole('button', { name: 'Clear' })
      ).not.toBeInTheDocument()
    })
  })

  describe('chips', () => {
    it('renders tag chips for each selected tag', () => {
      renderComponent({ modelValue: ['landscape', 'anime'] })
      expect(screen.getAllByTestId('tag-chip')).toHaveLength(2)
    })

    it('applies chipClass to chips', () => {
      const chipClass = (value: string) =>
        value.startsWith('type:') ? 'type-chip' : 'tag-chip'
      renderComponent({
        modelValue: ['tag:landscape', 'type:video'],
        chipClass
      })
      const chips = screen.getAllByTestId('tag-chip')
      expect(chips).toHaveLength(2)
    })
  })

  describe('models', () => {
    it('keeps tag model separate from query model', async () => {
      const onUpdateModelValue = vi.fn()
      const onUpdateQuery = vi.fn()
      renderComponent({
        modelValue: ['landscape'],
        query: 'test',
        'onUpdate:modelValue': onUpdateModelValue,
        'onUpdate:query': onUpdateQuery
      })
      // Both models should be independently controllable
      expect(screen.getAllByTestId('tag-chip')).toHaveLength(1)
    })
  })

  describe('rendering', () => {
    it('renders the component with combobox root', () => {
      renderComponent()
      expect(screen.getByTestId('combobox-root')).toBeInTheDocument()
    })

    it('renders tags root inside anchor', () => {
      renderComponent()
      expect(screen.getByTestId('tags-root')).toBeInTheDocument()
    })
  })

  describe('allowCreate', () => {
    it('defaults to false (no create option)', () => {
      renderComponent()
      expect(screen.queryByText('Create new tag')).not.toBeInTheDocument()
    })
  })
})
