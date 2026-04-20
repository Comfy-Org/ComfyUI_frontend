import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import FormSearchInput from './FormSearchInput.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        searchPlaceholder: 'Search {subject}',
        clear: 'Clear'
      }
    }
  }
})

function renderSearch(
  initialQuery: string = '',
  searcher?: (query: string) => Promise<void>
) {
  const query = ref(initialQuery)
  const Harness = defineComponent({
    components: { FormSearchInput },
    setup: () => ({ query, searcher }),
    template: '<FormSearchInput v-model="query" :searcher="searcher" />'
  })
  const utils = render(Harness, { global: { plugins: [i18n] } })
  return { ...utils, query }
}

describe('FormSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Input binding', () => {
    it('renders the initial query', () => {
      renderSearch('hello')
      expect(screen.getByRole('textbox')).toHaveValue('hello')
    })

    it('updates v-model as the user types', async () => {
      const { query } = renderSearch('')
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.type(screen.getByRole('textbox'), 'abc')
      expect(query.value).toBe('abc')
    })
  })

  describe('Clear button', () => {
    it('is hidden when the query is empty', () => {
      renderSearch('')
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    })

    it('is hidden when the query only contains whitespace', () => {
      renderSearch('   ')
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    })

    it('is shown when the query has non-whitespace text', () => {
      renderSearch('abc')
      expect(
        screen.getByRole('button', { name: 'Clear' })
      ).toBeInTheDocument()
    })

    it('clears the query when clicked', async () => {
      const { query } = renderSearch('abc')
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(screen.getByRole('button', { name: 'Clear' }))
      expect(query.value).toBe('')
    })
  })

  describe('Searcher integration', () => {
    it('calls searcher immediately on mount with the initial query', async () => {
      const searcher = vi.fn(async () => {})
      renderSearch('initial', searcher)
      await vi.advanceTimersByTimeAsync(0)
      expect(searcher).toHaveBeenCalled()
      expect(searcher.mock.calls[0][0]).toBe('initial')
    })

    it('debounces user input before calling searcher again', async () => {
      const searcher = vi.fn(async () => {})
      const { query } = renderSearch('', searcher)
      await vi.advanceTimersByTimeAsync(0)
      searcher.mockClear()

      query.value = 'a'
      query.value = 'ab'
      query.value = 'abc'
      await vi.advanceTimersByTimeAsync(100)
      expect(searcher).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(300)
      expect(searcher).toHaveBeenCalledTimes(1)
      expect(searcher.mock.calls[0][0]).toBe('abc')
    })
  })
})

