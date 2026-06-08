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

  it('surfaces the extension and detail as distinct fields from the message', () => {
    const store = useDeprecationWarningsStore()
    store.report({
      message: 'Use of defaultInput on a required input.',
      source: 'nodeDef',
      extension: 'custom_nodes.devtools',
      detail: 'DevToolsNode.int_input'
    })

    renderTab()

    screen.getByText('Use of defaultInput on a required input.')
    screen.getByText('nodeDef')
    screen.getByText('custom_nodes.devtools')
    screen.getByText('DevToolsNode.int_input')
  })

  it('shows the extension filter only when more than one extension is present', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'only ext.', source: 's', extension: 'ext.alpha' })

    const single = renderTab()
    expect(
      screen.queryByRole('button', {
        name: 'deprecationWarnings.filterByExtension'
      })
    ).toBeNull()
    single.unmount()

    store.report({
      message: 'second ext.',
      source: 's',
      extension: 'ext.bravo'
    })
    renderTab()
    screen.getByRole('button', {
      name: 'deprecationWarnings.filterByExtension'
    })
  })

  it('filters the list to the selected extension', async () => {
    const store = useDeprecationWarningsStore()
    store.report({
      message: 'from alpha',
      source: 'nodeDef',
      extension: 'ext.alpha'
    })
    store.report({
      message: 'from bravo',
      source: 'nodeDef',
      extension: 'ext.bravo'
    })

    const { user } = renderTab()
    screen.getByText('from alpha')
    screen.getByText('from bravo')

    await user.click(
      screen.getByRole('button', {
        name: 'deprecationWarnings.filterByExtension'
      })
    )
    await user.click(await screen.findByRole('option', { name: 'ext.alpha' }))

    screen.getByText('from alpha')
    expect(screen.queryByText('from bravo')).toBeNull()
  })

  it('filters to warnings without an extension via the Unknown option', async () => {
    const store = useDeprecationWarningsStore()
    store.report({
      message: 'has ext',
      source: 'nodeDef',
      extension: 'ext.alpha'
    })
    store.report({ message: 'no ext', source: 'litegraph' })

    const { user } = renderTab()
    screen.getByText('has ext')
    screen.getByText('no ext')

    await user.click(
      screen.getByRole('button', {
        name: 'deprecationWarnings.filterByExtension'
      })
    )
    await user.click(
      await screen.findByRole('option', {
        name: 'deprecationWarnings.unknownExtension'
      })
    )

    screen.getByText('no ext')
    expect(screen.queryByText('has ext')).toBeNull()
  })

  it('clears the extension filter when warnings are cleared', async () => {
    const store = useDeprecationWarningsStore()
    store.report({
      message: 'from alpha',
      source: 'nodeDef',
      extension: 'ext.alpha'
    })
    store.report({
      message: 'from bravo',
      source: 'nodeDef',
      extension: 'ext.bravo'
    })

    const { user } = renderTab()

    await user.click(
      screen.getByRole('button', {
        name: 'deprecationWarnings.filterByExtension'
      })
    )
    await user.click(await screen.findByRole('option', { name: 'ext.bravo' }))
    expect(screen.queryByText('from alpha')).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'deprecationWarnings.clearAll' })
    )
    store.report({
      message: 'fresh alpha',
      source: 'nodeDef',
      extension: 'ext.alpha'
    })

    await screen.findByText('fresh alpha')
    expect(screen.queryByText('deprecationWarnings.noMatches')).toBeNull()
  })

  it('renders a migration-guide link only when the warning has a docsUrl', () => {
    const store = useDeprecationWarningsStore()
    store.report({ message: 'no link here.' })
    store.report({
      message: 'has a guide.',
      docsUrl: 'https://docs.example/guide'
    })

    renderTab()

    const links = screen.getAllByRole('link', {
      name: 'deprecationWarnings.learnMore'
    })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://docs.example/guide')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
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
