import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import FacetSheet from './FacetSheet.vue'

const labels = {
  title: 'Filters',
  search: 'Search filters',
  noMatches: 'No matches',
  applied: (n: number) => `${n} applied`,
  clearAll: 'Clear all',
  show: (n: number) => `Show ${n}`,
  close: 'Close',
  resize: 'Resize filters'
}

const groups = [
  {
    key: 'provider',
    label: 'Provider',
    options: [
      { value: 'kling', label: 'Kling', count: 2 },
      { value: 'google', label: 'Google', count: 1 }
    ],
    selected: ['kling']
  },
  {
    key: 'media',
    label: 'Media',
    options: [{ value: 'video', label: 'Video', count: 3 }],
    selected: ['video']
  }
]

describe('FacetSheet', () => {
  it('toggles the sheet height from the keyboard', async () => {
    const user = userEvent.setup()
    render(FacetSheet, { props: { groups, labels, resultCount: 2 } })

    const grabber = screen.getByRole('button', { name: 'Resize filters' })
    expect(grabber.getAttribute('aria-expanded')).toBe('false')

    grabber.focus()
    await user.keyboard('{Enter}')
    expect(grabber.getAttribute('aria-expanded')).toBe('true')

    await user.keyboard(' ')
    expect(grabber.getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles from an assistive-technology click without pointer events', async () => {
    const user = userEvent.setup()
    render(FacetSheet, { props: { groups, labels, resultCount: 2 } })
    const grabber = screen.getByRole('button', { name: 'Resize filters' })

    await user.click(grabber)

    expect(grabber.getAttribute('aria-expanded')).toBe('true')
  })

  it('restores its prior rest when a drag is cancelled', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(width < 40rem)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    )
    const user = userEvent.setup()
    render(FacetSheet, { props: { groups, labels, resultCount: 2 } })
    const grabber = screen.getByRole('button', { name: 'Resize filters' })
    const grip = screen.getByTestId('workshop-filter-grip')
    // The sheet itself is intentionally presentational, so its visible height
    // is reached through the labelled grip rather than by inventing a role.
    // eslint-disable-next-line testing-library/no-node-access
    const sheet = grip.parentElement
    if (!sheet) throw new Error('Filter grip has no sheet parent')
    const restingHeight = sheet.style.height

    await user.pointer([
      { keys: '[MouseLeft>]', target: grabber, coords: { clientY: 500 } },
      { target: grabber, coords: { clientY: 200 } }
    ])
    expect(sheet.style.height).not.toBe(restingHeight)

    await fireEvent.pointerCancel(grabber, { pointerId: 1 })

    expect(sheet.style.height).toBe(restingHeight)
    expect(grabber.getAttribute('aria-expanded')).toBe('false')
  })

  it('filters options and shows the empty result', async () => {
    const user = userEvent.setup()
    render(FacetSheet, { props: { groups, labels, resultCount: 2 } })
    await user.type(screen.getByRole('searchbox'), 'kling')
    expect(screen.getByRole('button', { name: /Kling/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull()
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'missing')
    expect(screen.getByText('No matches')).toBeTruthy()
  })

  it('reports the total selections and resets to a remaining group', async () => {
    const user = userEvent.setup()
    const view = render(FacetSheet, {
      props: { groups, labels, resultCount: 2 }
    })
    expect(screen.getByText('2 applied')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: /^Media/ }))
    expect(screen.getByRole('tabpanel', { name: /^Media/ })).toBeTruthy()

    await view.rerender({ groups: [groups[0]], labels, resultCount: 1 })
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(await screen.findByRole('region', { name: 'Provider' })).toBeTruthy()
  })

  it('labels a lone group without exposing an inoperable tab', async () => {
    const view = render(FacetSheet, {
      props: { groups, labels, resultCount: 2 }
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /^Media/ }))
    expect(screen.getByRole('tab', { name: /^Media/ })).toBeEnabled()

    await view.rerender({ groups: [groups[1]], labels, resultCount: 1 })

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByRole('region', { name: 'Media' })).toHaveAttribute(
      'tabindex',
      '-1'
    )
  })
})
