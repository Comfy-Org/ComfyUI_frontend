import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import CatalogCheckedReview from './CatalogCheckedReview.vue'

describe('checkbox-only publication console', () => {
  it('ignores stored approvals and has no Defer/status command; checking writes nothing', async () => {
    const initial = fixtureReview()
    initial.items[0]!.decision = 'APPROVED'
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    expect(
      screen.getByRole('button', { name: 'Review selected (0)' })
    ).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Defer Selected' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Approve Selected' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Decision for Review fixture' })
    ).not.toBeInTheDocument()
    const check = screen.getByRole('checkbox', {
      name: 'Select Review fixture'
    })
    expect(check).not.toBeChecked()
    await fireEvent.click(check)
    expect(
      screen.getByRole('button', { name: 'Review selected (1)' })
    ).toBeEnabled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(initial.items[0]!.decision).toBe('APPROVED')
  })
  it('publishes exactly the checked set through read-only final review, despite unchecked NEW work', async () => {
    const initial = fixtureReview()
    const unchecked = structuredClone(initial.items[0]!)
    unchecked.content.uid = '00000000-0000-4000-8000-000000000020'
    unchecked.content.document.title = 'Unchecked old approval'
    unchecked.decision = 'APPROVED'
    initial.items.push(unchecked)
    initial.unresolved_count = 2
    const final = {
      state: initial.state,
      changes: [initial.items[0]],
      deferred: [unchecked],
      selection_digest: 'b'.repeat(64),
      publish_enabled: true
    }
    const state = {
      ...initial.state,
      live_rev: 7,
      draft_rev: 8,
      next_rev: 9,
      previous_live_rev: 1,
      draft_generation: 0
    }
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(final))
      .mockResolvedValueOnce(Response.json(state))
    vi.stubGlobal('fetch', fetcher)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Review selected (1)' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Final review' })
    expect(within(dialog).getByText('Staying in Draft')).toBeVisible()
    expect(within(dialog).queryByText('DEFERRED')).not.toBeInTheDocument()
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Publish' })
    )
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin/catalog'))
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/admin/catalog-api/final-review',
      '/admin/catalog-api/publish'
    ])
    const [first, second] = fetcher.mock.calls
    expect(JSON.parse(first![1].body)).toEqual({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      selected_uids: [initial.items[0]!.content.uid]
    })
    expect(JSON.parse(second![1].body)).toEqual({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      expected_selection_digest: 'b'.repeat(64),
      selected_uids: [initial.items[0]!.content.uid]
    })
    expect(first![1].method).toBe('POST')
    expect(first![1].headers.get('X-Comfy-CSRF')).toBe('fixture')
  })
  it('refuses an extra or newer server candidate and keeps publication closed', async () => {
    const initial = fixtureReview()
    const final = {
      state: { ...initial.state, draft_generation: 6 },
      changes: initial.items,
      deferred: [],
      selection_digest: 'b'.repeat(64),
      publish_enabled: true
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(final)))
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Review selected (1)' })
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This review is stale'
      )
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Review selected (1)' })
    ).toBeDisabled()
  })
  it('row trash confirms without requiring publisher authority and cancel writes nothing', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    render(CatalogCheckedReview, {
      props: {
        initial: fixtureReview(),
        csrf: 'fixture',
        canApply: false,
        canEdit: true
      }
    })
    await fireEvent.click(
      screen.getByRole('button', { name: 'Delete change for Review fixture' })
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete 1 changes?')).toBeVisible()
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('keeps bulk trash guarded by all-content acknowledgement, independently of publication', async () => {
    render(CatalogCheckedReview, {
      props: {
        initial: fixtureReview(),
        csrf: 'fixture',
        canApply: true,
        canEdit: true
      }
    })
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select all shown changes' })
    )
    expect(
      screen.getByRole('button', { name: 'Review selected (1)' })
    ).toBeEnabled()
    const discard = screen.getByRole('button', { name: 'Delete Changes' })
    expect(discard).toBeDisabled()
    await fireEvent.click(
      screen.getByRole('checkbox', { name: /unfiltered action/ })
    )
    expect(discard).toBeEnabled()
  })
})
