import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import FinalReviewDialog from './FinalReviewDialog.vue'
import { fixtureReview } from '@/lib/cms/staging-fixture'
import { canonicalQueue } from '@/lib/cms/canonical-queue'

describe('bounded final review list', () => {
  it('pages the displayed rows without changing the complete publication set', async () => {
    const user = userEvent.setup()
    const snapshot = fixtureReview()
    const first = snapshot.items[0]
    assert.exists(first)
    const items = canonicalQueue(
      Array.from({ length: 121 }, (_, index) => ({
        ...first,
        content: {
          ...first.content,
          uid: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
          document: { title: `Change ${index + 1}` }
        }
      }))
    )
    const currentItems = ref(items)
    const Harness = defineComponent({
      setup() {
        return () =>
          h(FinalReviewDialog, {
            open: true,
            items: currentItems.value,
            laterCount: 0,
            csrf: 'fixture',
            draftId: 7,
            generation: 5
          })
      }
    })
    render(Harness)
    const dialog = await screen.findByRole('dialog')
    const rows = () => within(dialog).getAllByRole('listitem')
    expect(rows()).toHaveLength(50)
    expect(within(dialog).getByText('Change 1')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Next page' }))
    expect(rows()).toHaveLength(50)
    expect(within(dialog).getByText('Change 51')).toBeVisible()
    expect(within(dialog).queryByText('Change 1')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Next page' }))
    expect(rows()).toHaveLength(21)
    expect(within(dialog).getByText('Change 121')).toBeVisible()
    expect(
      within(dialog).getByRole('button', { name: 'Next page' })
    ).toBeDisabled()
    // Paging changes presentation, not the data or confirmation total.
    expect(items).toHaveLength(121)
    expect(within(dialog).getByText('101–121 of 121')).toBeVisible()
    currentItems.value = items.slice(0, 1)
    expect(await within(dialog).findByText('Change 1')).toBeVisible()
    expect(rows()).toHaveLength(1)
  })
})
