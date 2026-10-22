import { render, screen, waitFor, within } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import { fixtureReceipt } from '@/lib/cms/review-receipt-fixture'
import { resolveAuthorProfile } from '@/lib/cms/author-profiles'
import CatalogCheckedReview from './CatalogCheckedReview.vue'

// Rows credit their author through the staff profile search; these tests
// count catalog requests, so the profile is answered here instead.
vi.mock(import('@/lib/cms/author-profiles'))
beforeEach(() => {
  vi.mocked(resolveAuthorProfile).mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000004',
    label: 'Fixture Author',
    username: 'fixture-author'
  })
})

function firstItem(review: ReturnType<typeof fixtureReview>) {
  const item = review.items[0]
  assert.exists(item)
  return item
}

describe('checkbox-only publication console', () => {
  it('reports final-review validation without claiming a discard or attempting a write', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          field_errors: [
            {
              path: '$.workflow_versions[0].download',
              message: 'Pinned media is not in the publication candidate',
              resource_uid: initial.items[0]?.content.uid
            }
          ]
        },
        { status: 422 }
      )
    )
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Review selected (1)' })
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The selected changes cannot be published')
    expect(alert).not.toHaveTextContent('discarded')
    expect(screen.getByText('$.workflow_versions[0].download')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      firstItem(initial).content.uid
    )
    expect(
      screen.getByText('Pinned media is not in the publication candidate')
    ).toBeVisible()
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/admin/catalog-api/review-receipt'
    ])
  })

  it('finds a batch label in the main search bar without writes', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    firstItem(initial).content.document.change_id = 'workfl_1016'
    const other = structuredClone(firstItem(initial))
    other.content.uid = '00000000-0000-4000-8000-000000000025'
    other.content.document.title = 'Unrelated change'
    other.content.document.change_id = 'another_batch'
    initial.items.push(other)
    const fetcher = vi.fn<typeof fetch>()
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await user.type(screen.getByRole('searchbox'), 'workfl_1016')
    expect(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    ).toBeVisible()
    expect(
      screen.queryByRole('checkbox', { name: 'Select Unrelated change' })
    ).not.toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps server filters reachable when a batch has no matches', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...initial,
            filter: { change_id: 'empty-batch' },
            items: []
          })
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(initial)))
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await user.click(
      screen.getByText('Apply filters / reload', { selector: 'summary' })
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Change ID (batch)' }),
      'empty-batch'
    )
    await user.click(
      screen.getByRole('button', { name: 'Apply filters / reload' })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('checkbox', { name: 'Select Review fixture' })
      ).not.toBeInTheDocument()
    )
    await user.click(
      screen.getByText('Apply filters / reload', { selector: 'summary' })
    )
    await user.clear(screen.getByRole('textbox', { name: 'Change ID (batch)' }))
    await user.click(
      screen.getByRole('button', { name: 'Apply filters / reload' })
    )
    await screen.findByRole('checkbox', { name: 'Select Review fixture' })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/admin/catalog-api/staging',
      expect.objectContaining({ method: 'GET' })
    )
  })
  it('requests the exact change batch and clears previous checked selection on refresh', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    const filtered = { ...initial, filter: { change_id: 'Workflow-batch_1.2' } }
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(filtered)))
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    await user.click(
      screen.getByText('Apply filters / reload', { selector: 'summary' })
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Change ID (batch)' }),
      'Workflow-batch_1.2'
    )
    await user.click(
      screen.getByRole('button', { name: 'Apply filters / reload' })
    )
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        '/admin/catalog-api/staging?change_id=Workflow-batch_1.2',
        expect.objectContaining({ method: 'GET' })
      )
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Review selected (0)' })
      ).toBeDisabled()
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('uses Mar’s tabs/search/table and keeps a checked hidden change without making writes', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    const original = initial.items[0]
    assert.exists(original)
    const added = structuredClone(original)
    added.content.uid = '00000000-0000-4000-8000-000000000025'
    added.content.document.title = 'New workflow'
    delete added.before
    initial.items.push(added)
    const fetcher = vi.fn()
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    expect(screen.getByRole('table', { name: 'Draft changes' })).toBeVisible()
    await user.click(screen.getByRole('radio', { name: 'New content 1' }))
    expect(
      screen.queryByRole('checkbox', { name: 'Select Review fixture' })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('checkbox', { name: 'Select New workflow' })
    )
    await user.click(screen.getByRole('radio', { name: 'All 2' }))
    await user.type(screen.getByRole('searchbox'), 'Review fixture')
    expect(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    ).not.toBeChecked()
    expect(
      screen.queryByRole('checkbox', { name: 'Select New workflow' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Review selected (1)' })
    ).toBeEnabled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('opens the real frozen JSON changes in Mar’s review drawer and cancels without writes', async () => {
    const user = userEvent.setup()
    const fetcher = vi.fn()
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogCheckedReview, {
      props: {
        initial: fixtureReview(),
        csrf: 'fixture',
        canApply: true,
        canEdit: true
      }
    })
    await user.click(screen.getByRole('button', { name: 'Review fixture' }))
    const drawer = await screen.findByRole('dialog', { name: 'Review fixture' })
    expect(within(drawer).getByText('$.title')).toBeVisible()
    expect(
      within(drawer).getByRole('link', { name: 'Open record' })
    ).toHaveAttribute(
      'href',
      '/admin/content/00000000-0000-4000-8000-000000000010/view?rev=7&version=00000000-0000-4000-8000-000000000011'
    )
    await user.click(within(drawer).getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('ignores stored approvals and has no Defer/status command; checking writes nothing', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    firstItem(initial).decision = 'APPROVED'
    const fetcher = vi.fn()
    vi.mocked(fetch).mockImplementation(fetcher)
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
    await user.click(check)
    expect(
      screen.getByRole('button', { name: 'Review selected (1)' })
    ).toBeEnabled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(firstItem(initial).decision).toBe('APPROVED')
  })
  it('publishes exactly the checked set through read-only final review, despite unchecked NEW work', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    const unchecked = structuredClone(firstItem(initial))
    unchecked.content.uid = '00000000-0000-4000-8000-000000000020'
    unchecked.content.document.title = 'Unchecked old approval'
    unchecked.decision = 'APPROVED'
    initial.items.push(unchecked)
    initial.unresolved_count = 2
    const final = await fixtureReceipt(initial, [
      firstItem(initial).content.uid
    ])
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
    vi.mocked(fetch).mockImplementation(fetcher)
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    await user.click(
      screen.getByRole('button', { name: 'Review selected (1)' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Final review' })
    expect(within(dialog).getByText('Staying in Draft')).toBeVisible()
    expect(within(dialog).queryByText('DEFERRED')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin/catalog'))
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/admin/catalog-api/review-receipt',
      '/admin/catalog-api/publish'
    ])
    const [first, second] = fetcher.mock.calls
    assert.exists(first)
    assert.exists(second)
    expect(JSON.parse(first[1].body)).toEqual({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      selected_uids: [firstItem(initial).content.uid]
    })
    expect(JSON.parse(second[1].body)).toEqual({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      expected_selection_digest: 'b'.repeat(64),
      selected_uids: [firstItem(initial).content.uid]
    })
    expect(first[1].method).toBe('POST')
    expect(first[1].headers.get('X-Comfy-CSRF')).toBe('fixture')
  })
  it('refuses an extra or newer server candidate and keeps publication closed', async () => {
    const user = userEvent.setup()
    const initial = fixtureReview()
    const final = await fixtureReceipt(initial, [
      firstItem(initial).content.uid
    ])
    final.state = { ...final.state, draft_generation: 6 }
    vi.mocked(fetch).mockImplementation(
      vi.fn().mockResolvedValue(Response.json(final))
    )
    render(CatalogCheckedReview, {
      props: { initial, csrf: 'fixture', canApply: true, canEdit: true }
    })
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    await user.click(
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
    const user = userEvent.setup()
    const fetcher = vi.fn()
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogCheckedReview, {
      props: {
        initial: fixtureReview(),
        csrf: 'fixture',
        canApply: false,
        canEdit: true
      }
    })
    await user.click(
      screen.getByRole('button', { name: 'Delete change for Review fixture' })
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete 1 changes?')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('keeps bulk trash guarded by all-content acknowledgement, independently of publication', async () => {
    const user = userEvent.setup()
    render(CatalogCheckedReview, {
      props: {
        initial: fixtureReview(),
        csrf: 'fixture',
        canApply: true,
        canEdit: true
      }
    })
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all shown changes' })
    )
    expect(
      screen.getByRole('button', { name: 'Review selected (1)' })
    ).toBeEnabled()
    const discard = screen.getByRole('button', { name: 'Delete Changes' })
    expect(discard).toBeDisabled()
    await user.click(
      screen.getByRole('checkbox', { name: /unfiltered action/ })
    )
    expect(discard).toBeEnabled()
  })
})
