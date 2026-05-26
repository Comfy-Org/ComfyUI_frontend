import { createTestingPinia } from '@pinia/testing'
import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import DeprecationWarningsTab from '@/components/sidebar/tabs/DeprecationWarningsTab.vue'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'

function renderTab() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {} }
  })
  return {
    user: userEvent.setup(),
    ...render(DeprecationWarningsTab, { global: { plugins: [i18n] } })
  }
}

describe('DeprecationWarningsTab', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    // Drain warnings buffered during module-load imports.
    useDeprecationWarningsStore().clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the empty state when there are no warnings', () => {
    renderTab()

    screen.getByText('deprecationWarnings.empty')
    expect(screen.queryByTestId('deprecation-warnings-list')).toBeNull()
  })

  it('renders each warning with its message, suggestion, and source', () => {
    const store = useDeprecationWarningsStore()
    store.report({
      message: 'foo() is deprecated.',
      suggestion: 'Use bar() instead.',
      source: 'lib'
    })

    renderTab()

    screen.getByText('foo() is deprecated.')
    screen.getByText('Use bar() instead.')
    screen.getByText('lib')
  })

  it('shows the per-warning count badge only when the warning has fired more than once', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'once' })
    store.report({ message: 'twice' })
    store.report({ message: 'twice' })

    renderTab()

    const badge = screen.getByTestId('deprecation-warning-badge')
    expect(badge.textContent).toBe('2')
    expect(badge.getAttribute('aria-label')).toBe(
      'deprecationWarnings.occurrenceCount'
    )
    expect(screen.queryAllByTestId('deprecation-warning-badge')).toHaveLength(1)
  })

  it('marks all warnings as seen on mount', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'one' })
    store.report({ message: 'two' })
    expect(store.unseenCount).toBe(2)

    renderTab()

    expect(store.unseenCount).toBe(0)
  })

  it('re-renders relative timestamps as time advances', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))

      const store = useDeprecationWarningsStore()
      store.report({ message: 'aged-out' })

      renderTab()
      screen.getByText('g.relativeTime.now')

      await vi.advanceTimersByTimeAsync(2 * 60_000)

      screen.getByText('g.relativeTime.minutesAgo')
    } finally {
      vi.useRealTimers()
    }
  })

  it('clear-all button empties the store and shows the empty state', async () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'one' })

    const { user } = renderTab()

    const clearAll = screen.getByRole('button', {
      name: 'deprecationWarnings.clearAll'
    })
    await user.click(clearAll)

    expect(store.warnings).toEqual([])
    screen.getByText('deprecationWarnings.empty')
  })
})
