import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import CatalogStaging from './CatalogStaging.vue'

function reviewed() {
  const review = fixtureReview()
  review.unresolved_count = 0
  review.items[0].decision = 'APPROVED'
  return review
}
function finalReview() {
  const review = reviewed()
  return {
    state: review.state,
    changes: review.items,
    deferred: [],
    selection_digest: 'b'.repeat(64),
    publish_enabled: true
  }
}

describe('one-page catalog final review', () => {
  it('loads the complete server candidate, not the filtered/checked list, and cancel writes nothing', async () => {
    const initial = reviewed()
    initial.filter = { search: 'fixture' }
    const final = finalReview()
    final.changes[0].content.document.title = 'Outside the filter'
    const fetcher = vi.fn().mockResolvedValue(Response.json(final))
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogStaging, {
      props: { initial, csrf: 'fixture', canEdit: true, canApply: true }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Review and publish' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Final review' })
    expect(within(dialog).getByText('Outside the filter')).toBeVisible()
    expect(
      within(dialog).getByRole('button', { name: 'Publish' })
    ).toBeEnabled()
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      '/admin/catalog-api/final-review',
      expect.objectContaining({ method: 'GET', cache: 'no-store' })
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Back to staging' })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Review and publish' })
    ).toBeEnabled()
  })
  it.for([409, 422, 503])(
    'keeps publication closed when final review returns %i',
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }))
      vi.mocked(fetch).mockImplementation(fetcher)
      render(CatalogStaging, {
        props: {
          initial: reviewed(),
          csrf: 'fixture',
          canEdit: true,
          canApply: true
        }
      })
      await userEvent.click(
        screen.getByRole('button', { name: 'Review and publish' })
      )
      await waitFor(() => expect(screen.getByRole('alert')).toBeVisible())
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Publish' })
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Approve Selected' })
      ).toBeDisabled()
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  )
  it('rejects a changed generation rather than silently reviewing new teammate work', async () => {
    const final = finalReview()
    final.state.draft_generation += 1
    vi.mocked(fetch).mockImplementation(
      vi.fn().mockResolvedValue(Response.json(final))
    )
    render(CatalogStaging, {
      props: {
        initial: reviewed(),
        csrf: 'fixture',
        canEdit: true,
        canApply: true
      }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Review and publish' })
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This review is stale'
      )
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('binds Publish to the final digest and freezes dismissal until the response settles', async () => {
    const final = finalReview()
    let release: (response: Response) => void = () => {}
    const publication = new Promise<Response>((resolve) => {
      release = resolve
    })
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(final))
      .mockReturnValueOnce(publication)
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogStaging, {
      props: {
        initial: reviewed(),
        csrf: 'fixture',
        canEdit: true,
        canApply: true
      }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Review and publish' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Final review' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Publish' })
    )
    expect(
      within(dialog).getByRole('button', { name: 'Back to staging' })
    ).toBeDisabled()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Back to staging' })
    )
    expect(dialog).toBeVisible()
    expect(fetcher.mock.calls[1]?.[0]).toBe('/admin/catalog-api/publish')
    const request = fetcher.mock.calls[1]?.[1]
    expect(JSON.parse(request.body)).toEqual({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      expected_selection_digest: 'b'.repeat(64)
    })
    expect(request.headers.get('X-Comfy-CSRF')).toBe('fixture')
    expect(request.headers.get('Idempotency-Key')).toMatch(/^[a-f0-9-]{36}$/)
    release(new Response(null, { status: 409 }))
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'This review is stale'
      )
    )
    expect(
      within(dialog).getByRole('button', { name: 'Back to staging' })
    ).toBeEnabled()
  })
  it('never automatically defers unresolved items to open the popup', async () => {
    const fetcher = vi.fn()
    vi.mocked(fetch).mockImplementation(fetcher)
    render(CatalogStaging, {
      props: {
        initial: fixtureReview(),
        csrf: 'fixture',
        canEdit: true,
        canApply: true
      }
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Review and publish' })
    )
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
