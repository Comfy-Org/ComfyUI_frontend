import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'
import { createI18n } from 'vue-i18n'

import SearchInput from './SearchInput.vue'

vi.mock('@vueuse/core', () => ({
  watchDebounced: vi.fn((source, cb, opts) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return watch(source, (val: string) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => cb(val), opts?.debounce ?? 300)
    })
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        clear: 'Clear',
        searchPlaceholder: 'Search...'
      }
    }
  }
})

describe('SearchInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function renderComponent(props = {}) {
    const result = render(SearchInput, {
      global: {
        plugins: [i18n],
        stubs: {
          ComboboxRoot: {
            template: '<div><slot /></div>'
          },
          ComboboxAnchor: {
            template: '<div @click="$emit(\'click\')"><slot /></div>',
            emits: ['click']
          },
          ComboboxInput: {
            template:
              '<input :placeholder="placeholder" :value="modelValue" :autofocus="autoFocus || undefined" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['placeholder', 'modelValue', 'autoFocus']
          }
        }
      },
      props: {
        modelValue: '',
        ...props
      }
    })

    return result
  }

  describe('debounced search', () => {
    it('should debounce search input by 300ms', async () => {
      const onSearch = vi.fn()
      renderComponent({ onSearch })
      const input = screen.getByRole('textbox')

      await fireEvent.update(input, 'test')

      expect(onSearch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(299)
      await nextTick()
      expect(onSearch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      await nextTick()

      expect(onSearch).toHaveBeenCalledWith('test')
    })

    it('should reset debounce timer on each keystroke', async () => {
      const onSearch = vi.fn()
      renderComponent({ onSearch })
      const input = screen.getByRole('textbox')

      await fireEvent.update(input, 't')
      vi.advanceTimersByTime(200)
      await nextTick()

      await fireEvent.update(input, 'te')
      vi.advanceTimersByTime(200)
      await nextTick()

      await fireEvent.update(input, 'tes')
      await vi.advanceTimersByTimeAsync(200)
      await nextTick()

      expect(onSearch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(100)
      await nextTick()

      expect(onSearch).toHaveBeenCalled()
      expect(onSearch).toHaveBeenCalledWith('tes')
    })

    it('should only emit final value after rapid typing', async () => {
      const onSearch = vi.fn()
      renderComponent({ onSearch })
      const input = screen.getByRole('textbox')

      const searchTerms = ['s', 'se', 'sea', 'sear', 'searc', 'search']
      for (const term of searchTerms) {
        await fireEvent.update(input, term)
        await vi.advanceTimersByTimeAsync(50)
      }
      await nextTick()

      expect(onSearch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(350)
      await nextTick()

      expect(onSearch).toHaveBeenCalledTimes(1)
      expect(onSearch).toHaveBeenCalledWith('search')
    })
  })

  describe('model sync', () => {
    it('should sync external model changes to internal state', async () => {
      const { rerender } = renderComponent({ modelValue: 'initial' })
      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('initial')

      await rerender({ modelValue: 'external update' })
      await nextTick()

      expect(input).toHaveValue('external update')
    })
  })

  describe('placeholder', () => {
    it('should use custom placeholder when provided', () => {
      renderComponent({ placeholder: 'Custom search...' })
      expect(
        screen.getByPlaceholderText('Custom search...')
      ).toBeInTheDocument()
    })

    it('should use i18n placeholder when not provided', () => {
      renderComponent()
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument()
    })
  })

  describe('autofocus', () => {
    it('should pass autofocus prop to ComboboxInput', () => {
      renderComponent({ autofocus: true })
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autofocus')
    })

    it('should not autofocus by default', () => {
      renderComponent()
      const input = screen.getByRole('textbox')
      expect(input).not.toHaveAttribute('autofocus')
    })
  })

  describe('clear button', () => {
    it('shows search icon when value is empty', () => {
      renderComponent({ modelValue: '' })
      expect(
        screen.queryByRole('button', { name: 'Clear' })
      ).not.toBeInTheDocument()
    })

    it('shows clear button when value is not empty', () => {
      renderComponent({ modelValue: 'test' })
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })

    it('clears value when clear button is clicked', async () => {
      const onUpdate = vi.fn()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderComponent({
        modelValue: 'test',
        'onUpdate:modelValue': onUpdate
      })
      await user.click(screen.getByRole('button', { name: 'Clear' }))
      expect(onUpdate).toHaveBeenCalledWith('')
    })
  })
})
