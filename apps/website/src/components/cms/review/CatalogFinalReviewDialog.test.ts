import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { fixtureReview } from '@/lib/cms/staging-fixture'
import type { FinalReview } from '@/lib/cms/staging-review'
import CatalogFinalReviewDialog from './CatalogFinalReviewDialog.vue'

function finalReview(): FinalReview {
  const review = fixtureReview()
  return {
    state: review.state,
    changes: review.items,
    deferred: [],
    selection_digest: 'b'.repeat(64),
    publish_enabled: true
  }
}

describe('catalog final review popup', () => {
  it('binds Publish to the final digest and freezes dismissal until the response settles', async () => {
    let release: (response: Response) => void = () => {}
    const publication = new Promise<Response>((resolve) => {
      release = resolve
    })
    const fetcher = vi.fn().mockReturnValueOnce(publication)
    vi.mocked(fetch).mockImplementation(fetcher)
    const { emitted } = render(CatalogFinalReviewDialog, {
      props: { review: finalReview(), csrf: 'fixture' }
    })
    const dialog = await screen.findByRole('dialog', { name: 'Final review' })
    expect(within(dialog).getByText('Review fixture')).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Publish' })
    )
    const back = within(dialog).getByRole('button', {
      name: 'Back to staging'
    })
    expect(back).toBeDisabled()
    await userEvent.click(back)
    expect(emitted().close).toBeUndefined()
    expect(fetcher.mock.calls[0]?.[0]).toBe('/admin/catalog-api/publish')
    const request = fetcher.mock.calls[0]?.[1]
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
    expect(back).toBeEnabled()
    await userEvent.click(back)
    expect(emitted().close).toHaveLength(1)
  })

  it('names the unchecked changes that stay in the Draft', async () => {
    const review = finalReview()
    const [first] = review.changes
    review.deferred = [first]
    render(CatalogFinalReviewDialog, {
      props: { review, csrf: 'fixture' }
    })
    const dialog = await screen.findByRole('dialog', { name: 'Final review' })
    expect(within(dialog).getByText('Staying in Draft')).toBeVisible()
    expect(within(dialog).queryByText(/defer/i)).toBeNull()
  })
})
