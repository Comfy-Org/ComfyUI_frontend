import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import { fixtureReceipt } from '@/lib/cms/review-receipt-fixture'
import CatalogCheckedReceiptDialog from './CatalogCheckedReceiptDialog.vue'

describe('receipt-bound confirmation', () => {
  it('keeps exact selection and dismissal frozen during publication', async () => {
    const snapshot = fixtureReview()
    const selectedUids = snapshot.items.map((item) => item.content.uid)
    const receipt = await fixtureReceipt(snapshot, selectedUids)
    let release: (response: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      release = resolve
    })
    const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(pending)
    vi.mocked(fetch).mockImplementation(fetcher)
    const { emitted } = render(CatalogCheckedReceiptDialog, {
      props: { receipt, changes: snapshot.items, selectedUids, csrf: 'fixture' }
    })
    const dialog = await screen.findByRole('dialog', { name: 'Final review' })
    expect(within(dialog).getByText('Review fixture')).toBeVisible()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Publish' })
    )
    const back = within(dialog).getByRole('button', { name: 'Back to staging' })
    expect(back).toBeDisabled()
    await userEvent.click(back)
    expect(emitted().close).toBeUndefined()
    const [url, request] = fetcher.mock.calls[0] ?? []
    expect(url).toBe('/admin/catalog-api/publish')
    expect(JSON.parse(String(request?.body))).toEqual({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      selected_uids: selectedUids,
      expected_selection_digest: receipt.selection_digest
    })
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
})
