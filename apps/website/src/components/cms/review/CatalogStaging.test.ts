import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import CatalogStaging from './CatalogStaging.vue'

describe('actual catalog staging console', () => {
  it('places Add Content beside the list actions, without requiring a selection', () => {
    render(CatalogStaging, {
      props: {
        initial: fixtureReview(),
        csrf: 'a'.repeat(64),
        canApply: true,
        canEdit: true
      }
    })
    const add = screen.getByRole('link', { name: 'Add Content' })
    expect(add).toHaveAttribute('href', '/admin/content/new')
    expect(add.closest('header')).toBeNull()
    expect(
      screen.queryByRole('link', { name: 'New content' })
    ).not.toBeInTheDocument()
    const actions = add.parentElement
    if (!actions) throw new Error('Missing list action bar')
    expect(
      within(actions).getByRole('button', { name: 'Approve Selected' })
    ).toBeDisabled()
    expect(
      within(actions).getByRole('button', { name: 'Defer Selected' })
    ).toBeDisabled()
    expect(
      within(actions).getByRole('button', { name: 'Delete Changes' })
    ).toBeDisabled()
  })
  it('hides Add Content from apply-only reviewers', () => {
    render(CatalogStaging, {
      props: {
        initial: fixtureReview(),
        csrf: 'a'.repeat(64),
        canApply: true,
        canEdit: false
      }
    })
    expect(
      screen.queryByRole('link', { name: 'Add Content' })
    ).not.toBeInTheDocument()
  })
  it('row trash confirms exact scope; cancel writes nothing, edit-only can discard', async () => {
    const initial = fixtureReview()
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    render(CatalogStaging, {
      props: { initial, csrf: 'a'.repeat(64), canApply: false, canEdit: true }
    })
    expect(
      screen.getByRole('button', { name: 'Delete Changes' })
    ).toBeDisabled()
    await fireEvent.click(
      screen.getByRole('button', { name: 'Delete change for Review fixture' })
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete 1 changes?')).toBeVisible()
    expect(
      within(dialog).getByText(initial.items[0]!.content.uid)
    ).toBeVisible()
    expect(
      within(dialog).getByText(
        /LIVE stays unchanged and edit history is retained/
      )
    ).toBeVisible()
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete change for Review fixture' })
    ).toBeEnabled()
  })
  it('bulk discard freezes explicit saves and removes only confirmed changes', async () => {
    const initial = fixtureReview()
    const after = fixtureReview()
    after.items = []
    after.unresolved_count = 0
    after.state.draft_generation += 1
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(after))
      .mockResolvedValueOnce(Response.json(after))
    vi.stubGlobal('fetch', fetcher)
    render(CatalogStaging, {
      props: { initial, csrf: 'a'.repeat(64), canApply: true, canEdit: true }
    })
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    expect(
      screen.getByRole('button', { name: 'Delete Changes' })
    ).toBeDisabled()
    await fireEvent.click(
      screen.getByRole('checkbox', { name: /unfiltered action/ })
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Delete Changes' })
    )
    expect(fetcher).not.toHaveBeenCalled()
    await fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete Changes'
      })
    )
    await waitFor(() =>
      expect(
        screen.getByText(
          'Changes discarded. LIVE is unchanged and history is retained.'
        )
      ).toBeVisible()
    )
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(url).toBe('/admin/catalog-api/discard-changes')
    expect(JSON.parse(init.body)).toMatchObject({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      expected_count: 1,
      expected_selection_digest: initial.selection_digest,
      targets: [
        {
          uid: initial.items[0]!.content.uid,
          expected_revision_uid: initial.items[0]!.content.revision_uid
        }
      ],
      confirm_discard: true
    })
    expect(
      screen.queryByRole('button', { name: 'Delete change for Review fixture' })
    ).not.toBeInTheDocument()
  })
  it.each([true, false])(
    'toggles bulk delete with all-content acknowledgement (apply=%s)',
    async (canApply) => {
      const fetcher = vi.fn()
      vi.stubGlobal('fetch', fetcher)
      render(CatalogStaging, {
        props: {
          initial: fixtureReview(),
          csrf: 'a'.repeat(64),
          canApply,
          canEdit: true
        }
      })
      await fireEvent.click(
        screen.getByRole('checkbox', { name: 'Select all matching results' })
      )
      const button = screen.getByRole('button', { name: 'Delete Changes' })
      const acknowledge = screen.getByRole('checkbox', {
        name: /unfiltered action/
      })
      expect(button).toBeDisabled()
      await fireEvent.click(button)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await fireEvent.click(acknowledge)
      expect(button).toBeEnabled()
      await fireEvent.click(acknowledge)
      expect(button).toBeDisabled()
      await fireEvent.click(acknowledge)
      await fireEvent.click(button)
      expect(screen.getByRole('dialog')).toBeVisible()
      await fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Cancel'
        })
      )
      await fireEvent.click(
        screen.getByRole('checkbox', { name: 'Select all matching results' })
      )
      await fireEvent.click(
        screen.getByRole('checkbox', { name: 'Select all matching results' })
      )
      expect(
        screen.getByRole('checkbox', { name: /unfiltered action/ })
      ).not.toBeChecked()
      expect(button).toBeDisabled()
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it('keeps filtered bulk discard available with its confirmation, without all-content acknowledgement', async () => {
    const initial = fixtureReview()
    initial.filter = { search: 'fixture' }
    vi.stubGlobal('fetch', vi.fn())
    render(CatalogStaging, {
      props: { initial, csrf: 'a'.repeat(64), canApply: false, canEdit: true }
    })
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select all matching results' })
    )
    expect(
      screen.queryByRole('checkbox', { name: /unfiltered action/ })
    ).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Delete Changes' })
    expect(button).toBeEnabled()
    await fireEvent.click(button)
    expect(screen.getByRole('dialog')).toBeVisible()
  })
  it('dependency errors retain the full pending list and display escaped JSON paths', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            field_errors: [
              {
                path: '$.workflow_uid',
                message: 'Discard would leave a dangling workflow'
              }
            ]
          },
          { status: 422 }
        )
      )
    )
    render(CatalogStaging, {
      props: {
        initial: fixtureReview(),
        csrf: 'a'.repeat(64),
        canApply: true,
        canEdit: true
      }
    })
    await fireEvent.click(
      screen.getByRole('button', { name: 'Delete change for Review fixture' })
    )
    await fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete Changes'
      })
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '$.workflow_uid: Discard would leave a dangling workflow'
      )
    )
    expect(
      screen.getByRole('button', { name: 'Delete change for Review fixture' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: /Apply filters/ })).toBeEnabled()
  })
  it('renders compact changes and array-aware diff without exposing unavailable navigation', async () => {
    render(CatalogStaging, {
      props: {
        initial: fixtureReview(),
        csrf: 'a'.repeat(64),
        canApply: false,
        canEdit: true
      }
    })
    expect(
      screen.queryByRole('button', { name: 'Approve Selected' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /History|All content/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Drafts/ })).toHaveAttribute(
      'href',
      '/admin/catalog'
    )
    await fireEvent.click(
      screen.getByRole('button', {
        name: 'Review fixture Modified: title, tags, examples'
      })
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('$.examples[1]')).toBeVisible()
    expect(within(dialog).getByText('{"title":"B"}')).toBeVisible()
  })
  it('requires all-content acknowledgement and binds reviewed count/digest to the confirmed mutation', async () => {
    const initial = fixtureReview()
    const updated = fixtureReview()
    if (updated.items[0]) updated.items[0].decision = 'APPROVED'
    updated.unresolved_count = 0
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(updated))
      .mockResolvedValueOnce(Response.json(updated))
    vi.stubGlobal('fetch', fetcher)
    render(CatalogStaging, {
      props: { initial, csrf: 'a'.repeat(64), canApply: true, canEdit: true }
    })
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select all matching results' })
    )
    expect(
      screen.getByRole('button', { name: 'Approve Selected' })
    ).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
    await fireEvent.click(
      screen.getByRole('checkbox', { name: /unfiltered action/ })
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Approve Selected' })
    )
    await waitFor(() =>
      expect(
        screen.getByText('Decisions saved. Live content is unchanged.')
      ).toBeVisible()
    )
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(url).toBe('/admin/catalog-api/staging')
    expect(JSON.parse(init.body)).toMatchObject({
      expected_selection_digest: initial.selection_digest,
      expected_count: 1,
      confirm_all: true,
      status: 'APPROVED',
      review: { expected_draft_generation: 5 },
      selected_uids: [initial.items[0]?.content.uid]
    })
    expect(
      screen.getByRole('button', { name: 'Decision for Review fixture' })
    ).toHaveTextContent('APPROVED')
    expect(
      screen.getByRole('button', { name: 'Review and publish' })
    ).toBeEnabled()
  })
  it('fails stale decisions closed and requires a reload before any next staging action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 409 }))
    )
    render(CatalogStaging, {
      props: {
        initial: fixtureReview(),
        csrf: 'a'.repeat(64),
        canApply: true,
        canEdit: true
      }
    })
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select all matching results' })
    )

    await fireEvent.click(
      screen.getByRole('checkbox', { name: /unfiltered action/ })
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Defer Selected' })
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This review is stale'
      )
    )
    expect(
      screen.getByRole('button', { name: 'Approve Selected' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Apply filters / reload' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Decision for Review fixture' })
    ).toHaveTextContent('NEW')
  })
  it('approves a checkbox subset against the full frozen filter without changing unchecked records', async () => {
    const initial = fixtureReview()
    const first = initial.items[0]
    if (!first) throw new Error('Missing test row')
    initial.items.push({
      ...structuredClone(first),
      content: {
        ...structuredClone(first.content),
        uid: '00000000-0000-4000-8000-000000000020',
        document: { title: 'Unchecked media' },
        type: 'media'
      }
    })
    const updated = structuredClone(initial)
    initial.unresolved_count = 2
    updated.unresolved_count = 1
    if (updated.items[0]) updated.items[0].decision = 'APPROVED'
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(updated))
      .mockResolvedValueOnce(Response.json(updated))
    vi.stubGlobal('fetch', fetcher)
    render(CatalogStaging, {
      props: { initial, csrf: 'a'.repeat(64), canApply: true, canEdit: true }
    })
    expect(screen.getByText('PHASE 1')).toBeVisible()
    expect(screen.getByText('Approve or defer all new content.')).toBeVisible()
    expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Approve Selected' })
    ).toBeDisabled()
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select Review fixture' })
    )
    await fireEvent.click(
      screen.getByRole('button', { name: 'Approve Selected' })
    )
    expect(
      screen.queryByRole('checkbox', { name: /unfiltered action/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByText('Decisions saved. Live content is unchanged.')
      ).toBeVisible()
    )
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      expected_count: 2,
      expected_selection_digest: initial.selection_digest,
      selected_uids: [first.content.uid],
      confirm_all: false
    })
    expect(
      screen.getByRole('button', { name: 'Decision for Unchecked media' })
    ).toHaveTextContent('NEW')
    expect(
      screen.getByRole('button', { name: 'Decision for Review fixture' })
    ).toHaveTextContent('APPROVED')
    expect(
      screen.getByRole('button', { name: 'Approve Selected' })
    ).toBeDisabled()
  })
  it.each([1, 4])(
    'blocks final review for %i undecided entries even when filters show only an approved row',
    (count) => {
      const initial = fixtureReview()
      initial.filter = { statuses: ['APPROVED'] }
      initial.unresolved_count = count
      if (initial.items[0]) initial.items[0].decision = 'APPROVED'
      render(CatalogStaging, {
        props: {
          initial,
          csrf: 'a'.repeat(64),
          canApply: true,
          canEdit: true
        }
      })
      expect(
        screen.getByRole('button', { name: 'Review and publish' })
      ).toBeDisabled()
      expect(
        screen.queryByRole('link', { name: 'Next →' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByText(
          `You still have ${count} entries not approved or deferred.`
        )
      ).toBeVisible()
    }
  )
  it('shows NEW as a warning badge, not a select widget; decisions open on demand', async () => {
    render(CatalogStaging, {
      props: {
        initial: fixtureReview(),
        csrf: 'a'.repeat(64),
        canApply: true,
        canEdit: true
      }
    })
    const badge = screen.getByRole('button', {
      name: 'Decision for Review fixture'
    })
    expect(badge).toHaveAttribute(
      'title',
      'All New Items must be set to approve or deferred.'
    )
    expect(
      screen.queryByRole('combobox', { name: 'Decision for Review fixture' })
    ).not.toBeInTheDocument()
    await fireEvent.keyDown(badge, { key: 'ArrowDown' })
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'APPROVED' })).toBeVisible()
    )
    expect(screen.getByRole('menuitem', { name: 'DEFERRED' })).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'NEW' })
    ).not.toBeInTheDocument()
  })
})
