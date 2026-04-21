import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
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

type Searcher = NonNullable<ComponentProps<typeof FormSearchInput>['searcher']>

function renderSearch(
  initialQuery: string = '',
  searcher?: Searcher,
  updateKey?: { value: unknown }
) {
  const query = ref(initialQuery)
  const key = updateKey
  const Harness = defineComponent({
    components: { FormSearchInput },
    setup: () => ({ query, searcher, key }),
    template: `<FormSearchInput
      v-model="query"
      :searcher="searcher"
      :update-key="key"
    />`
  })
  const utils = render(Harness, { global: { plugins: [i18n] } })
  return { ...utils, query, key }
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
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
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
      const searcher = vi.fn<Searcher>(async () => {})
      renderSearch('initial', searcher)
      await vi.advanceTimersByTimeAsync(0)
      expect(searcher).toHaveBeenCalled()
      expect(searcher.mock.calls[0][0]).toBe('initial')
    })

    it('debounces user input before calling searcher again', async () => {
      const searcher = vi.fn<Searcher>(async () => {})
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

  describe('updateKey refresh', () => {
    it('reruns the searcher when updateKey changes even if the query is unchanged', async () => {
      const searcher = vi.fn<Searcher>(async () => {})
      const updateKey = ref(1)
      renderSearch('query', searcher, updateKey)
      await vi.advanceTimersByTimeAsync(0)
      searcher.mockClear()

      updateKey.value = 2
      await vi.advanceTimersByTimeAsync(300)

      expect(searcher).toHaveBeenCalledTimes(1)
      expect(searcher.mock.calls[0][0]).toBe('query')
    })
  })

  describe('Stale-result cancellation via onCleanup', () => {
    it('invokes the cleanup registered by a superseded search before starting the next one', async () => {
      const cleanupA = vi.fn()
      const cleanupB = vi.fn()
      let call = 0
      const searcher: Searcher = async (_q, onCleanup) => {
        const current = ++call
        onCleanup(current === 1 ? cleanupA : cleanupB)
      }

      const { query } = renderSearch('', searcher)
      await vi.advanceTimersByTimeAsync(0)
      // First call registered its cleanup
      expect(cleanupA).not.toHaveBeenCalled()

      // Supersede it with a new query
      query.value = 'next'
      await vi.advanceTimersByTimeAsync(300)

      // The first search's cleanup must run before the second registers its own
      expect(cleanupA).toHaveBeenCalledTimes(1)
      // Latest active search's cleanup has not fired yet
      expect(cleanupB).not.toHaveBeenCalled()
    })
  })
})
