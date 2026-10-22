import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import SearchAutocomplete from './SearchAutocomplete.vue'

describe('SearchAutocomplete', () => {
  it('renders caller labels without an i18n plugin', () => {
    render(SearchAutocomplete, {
      props: {
        modelValue: 'abc',
        accessibleLabel: 'Rechercher',
        clearLabel: 'Effacer',
        placeholder: 'Rechercher...'
      }
    })
    expect(
      screen.getByRole('combobox', { name: 'Rechercher' })
    ).toHaveAttribute('placeholder', 'Rechercher...')
    expect(screen.getByRole('button', { name: 'Effacer' })).toBeVisible()
  })

  function renderComponent(props: Record<string, unknown> = {}) {
    return render(SearchAutocomplete, {
      global: {
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
      props: {
        accessibleLabel: 'Search',
        clearLabel: 'Clear',
        modelValue: '',
        ...props
      }
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

    it('can select without replacing the typed query', async () => {
      const onUpdateModelValue = vi.fn()
      const user = userEvent.setup()
      renderComponent({
        modelValue: 'fo',
        suggestions: ['foo'],
        updateModelOnSelect: false,
        'onUpdate:modelValue': onUpdateModelValue
      })

      await user.click(screen.getByText('foo'))

      expect(onUpdateModelValue).not.toHaveBeenCalled()
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

  it('opens empty-query suggestions on focus and reports keyboard highlight', async () => {
    const onHighlight = vi.fn()
    const user = userEvent.setup()
    render(SearchAutocomplete, {
      props: {
        modelValue: '',
        suggestions: ['foo', 'bar'],
        openOnFocus: true,
        accessibleLabel: 'Search',
        clearLabel: 'Clear',
        onHighlight
      }
    })

    const input = screen.getByRole('combobox')
    await user.click(input)
    expect(await screen.findByRole('option', { name: 'foo' })).toBeVisible()
    await waitFor(() => expect(onHighlight).toHaveBeenCalledWith('foo'))
    onHighlight.mockClear()

    await user.keyboard('{ArrowDown}')
    await waitFor(() => expect(onHighlight).toHaveBeenCalledWith('bar'))
  })

  it.for(['Home', 'End'])(
    'leaves Shift+%s to the input instead of moving the highlight',
    async (key) => {
      const onHighlight = vi.fn()
      const user = userEvent.setup()
      render(SearchAutocomplete, {
        props: {
          modelValue: 'fo',
          suggestions: ['foo', 'bar', 'baz'],
          openOnFocus: true,
          accessibleLabel: 'Search',
          clearLabel: 'Clear',
          onHighlight
        }
      })

      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.keyboard('{ArrowDown}')
      await waitFor(() => expect(onHighlight).toHaveBeenLastCalledWith('bar'))
      onHighlight.mockClear()

      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      })
      input.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
      expect(onHighlight).not.toHaveBeenCalled()
      expect(screen.getByRole('option', { name: 'bar' })).toHaveAttribute(
        'data-highlighted'
      )
    }
  )

  it('lets Shift+Home reach leading-slot controls', () => {
    render(SearchAutocomplete, {
      props: {
        modelValue: 'fo',
        suggestions: ['foo'],
        accessibleLabel: 'Search',
        clearLabel: 'Clear'
      },
      slots: { leading: () => h('button', 'Filter chip') }
    })
    const chip = screen.getByRole('button', { name: 'Filter chip' })
    const onChipKeydown = vi.fn()
    chip.addEventListener('keydown', onChipKeydown)

    chip.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Home',
        shiftKey: true,
        bubbles: true
      })
    )

    expect(onChipKeydown).toHaveBeenCalledOnce()
  })

  it('highlights the first suggestion when results change', async () => {
    const onHighlight = vi.fn()
    const { rerender } = render(SearchAutocomplete, {
      props: {
        modelValue: 'foo',
        suggestions: [],
        accessibleLabel: 'Search',
        clearLabel: 'Clear',
        onHighlight
      }
    })

    await rerender({ suggestions: ['foo', 'bar'] })

    expect(await screen.findByRole('option', { name: 'foo' })).toBeVisible()
    await waitFor(() => expect(onHighlight).toHaveBeenCalledWith('foo'))
  })

  it('does not treat a matching query as a selected suggestion', async () => {
    const user = userEvent.setup()
    render(SearchAutocomplete, {
      props: {
        modelValue: 'foo',
        suggestions: ['foo', 'bar'],
        accessibleLabel: 'Search',
        clearLabel: 'Clear',
        openOnFocus: true
      }
    })

    await user.click(screen.getByRole('combobox'))

    expect(await screen.findByRole('option', { name: 'foo' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
  })

  it('does not select an option when Enter is pressed during composition', async () => {
    const onSelect = vi.fn()
    const onUpdateModelValue = vi.fn()
    const user = userEvent.setup()
    render(SearchAutocomplete, {
      props: {
        modelValue: '',
        suggestions: ['foo'],
        openOnFocus: true,
        accessibleLabel: 'Search',
        clearLabel: 'Clear',
        onSelect,
        'onUpdate:modelValue': onUpdateModelValue
      }
    })

    const input = screen.getByRole('combobox')
    await user.click(input)
    await screen.findByRole('option', { name: 'foo' })
    await user.keyboard('{ArrowDown}')
    await fireEvent.compositionStart(input)
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('')
    expect(onUpdateModelValue).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()

    await fireEvent.compositionEnd(input)
    await user.click(input)
    await screen.findByRole('option', { name: 'foo' })
    await user.keyboard('{Home}')
    await user.keyboard('{Enter}')

    expect(onUpdateModelValue).toHaveBeenCalledWith('foo')
    expect(onSelect).toHaveBeenCalledWith('foo')
  })
})
