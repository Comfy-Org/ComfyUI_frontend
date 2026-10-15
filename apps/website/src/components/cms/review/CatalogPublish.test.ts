import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import { publicationPayload } from '@/lib/cms/staging-review'
import { reviewRequest } from '@/lib/cms/staging-client'
import CatalogPublish from './CatalogPublish.vue'

vi.mock(import('@/lib/cms/staging-client'))
function final(enabled = true) {
  const snapshot = fixtureReview()
  return {
    state: snapshot.state,
    changes: snapshot.items,
    deferred: [],
    selection_digest: snapshot.selection_digest,
    publish_enabled: enabled
  }
}
function published() {
  return {
    ...fixtureReview().state,
    live_rev: 7,
    draft_rev: 8,
    next_rev: 9,
    previous_live_rev: 1,
    draft_generation: 0
  }
}
describe('temporary local Publish', () => {
  it('stays disabled unless the backend explicitly enables publication', async () => {
    render(CatalogPublish, { props: { review: final(false), csrf: 'fixture' } })
    const button = screen.getByRole('button', { name: 'Publish' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(reviewRequest).not.toHaveBeenCalled()
  })
  it('binds the exact final review and redirects only after confirmed fresh state', async () => {
    const review = final()
    vi.mocked(reviewRequest).mockResolvedValue({
      ok: true,
      status: 200,
      data: published()
    })
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPublish, { props: { review, csrf: 'fixture' } })
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/admin/catalog'))
    const [operation, options] = vi.mocked(reviewRequest).mock.calls[0]
    expect(operation).toBe('publish')
    expect(options?.csrf).toBe('fixture')
    expect(JSON.parse(options?.body ?? '')).toEqual(publicationPayload(review))
    expect(options?.key).toMatch(/^[a-f0-9-]{36}$/)
  })
  it('retains the same idempotency key after an uncertain failure', async () => {
    vi.mocked(reviewRequest)
      .mockResolvedValueOnce({ ok: false, status: 503, data: undefined })
      .mockResolvedValueOnce({ ok: true, status: 200, data: published() })
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPublish, { props: { review: final(), csrf: 'fixture' } })
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible())
    expect(assign).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(assign).toHaveBeenCalled())
    expect(vi.mocked(reviewRequest).mock.calls[0]?.[1]?.key).toBe(
      vi.mocked(reviewRequest).mock.calls[1]?.[1]?.key
    )
  })
  it('does not redirect on stale review or malformed success', async () => {
    vi.mocked(reviewRequest).mockResolvedValue({
      ok: false,
      status: 409,
      data: undefined
    })
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {})
    render(CatalogPublish, { props: { review: final(), csrf: 'fixture' } })
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This review is stale.'
      )
    )
    expect(assign).not.toHaveBeenCalled()
    vi.mocked(reviewRequest).mockResolvedValue({
      ok: true,
      status: 200,
      data: {}
    })
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The action could not be confirmed.'
      )
    )
    expect(assign).not.toHaveBeenCalled()
  })
})
