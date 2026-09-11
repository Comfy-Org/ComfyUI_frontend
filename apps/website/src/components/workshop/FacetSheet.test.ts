// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import FacetSheet from './FacetSheet.vue'

const labels = {
  title: 'Filters',
  search: 'Search filters',
  noMatches: 'No matches',
  applied: '{n} applied',
  clearAll: 'Clear all',
  show: 'Show {n}',
  close: 'Close'
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
    expect(
      screen.getByRole('tab', { name: /^Provider/, selected: true })
    ).toBeTruthy()
  })
})
