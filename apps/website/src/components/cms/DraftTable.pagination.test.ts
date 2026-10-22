import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CatalogQueueItem } from '@/lib/cms/queue'
import DraftTable from './DraftTable.vue'

function changes(): CatalogQueueItem[] {
  return Array.from({ length: 125 }, (_, index) => ({
    source: 'catalog',
    id: `fixture-${index + 1}`,
    kind: 'WORKFLOW',
    title: `Workflow ${index + 1}`,
    change: 'new',
    slug: `workflow-${index + 1}`,
    hidden: false,
    fields: [],
    gaps: []
  }))
}

describe('bounded Draft change rendering', () => {
  it('mounts only one page of rows and keeps other changes reachable', async () => {
    const user = userEvent.setup()
    render(DraftTable, { props: { items: changes() } })
    expect(screen.getAllByRole('row')).toHaveLength(51)
    expect(screen.getByRole('button', { name: 'Workflow 1' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Workflow 51' })).toBeNull()
    expect(screen.getByText('1–50 of 125')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getAllByRole('row')).toHaveLength(51)
    expect(screen.getByRole('button', { name: 'Workflow 51' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Workflow 1' })).toBeNull()
    expect(screen.getByText('51–100 of 125')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getAllByRole('row')).toHaveLength(26)
    expect(screen.getByRole('button', { name: 'Workflow 125' })).toBeVisible()
    expect(screen.getByText('101–125 of 125')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('preserves cross-page picks and the explicit all-matching selection scope', async () => {
    const user = userEvent.setup()
    const view = render(DraftTable, {
      props: {
        items: changes(),
        selectable: true,
        selected: ['fixture-1', 'fixture-51']
      }
    })
    expect(
      screen.getByRole('checkbox', { name: 'Select Workflow 1' })
    ).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      screen.getByRole('checkbox', { name: 'Select Workflow 51' })
    ).toBeChecked()
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all 125 matching changes' })
    )
    expect(view.emitted('all')).toEqual([[true]])
    expect(view.emitted('select')).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(
      screen.getByRole('checkbox', { name: 'Select Workflow 1' })
    ).toBeChecked()
  })

  it('returns to the first page when the matching list changes', async () => {
    const user = userEvent.setup()
    const view = render(DraftTable, { props: { items: changes() } })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await view.rerender({ items: changes().slice(0, 2) })
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Workflow 1' })).toBeVisible()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('disables page navigation while the reviewed state is busy', async () => {
    const user = userEvent.setup()
    render(DraftTable, { props: { items: changes(), disabled: true } })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('1–50 of 125')).toBeVisible()
  })
})
