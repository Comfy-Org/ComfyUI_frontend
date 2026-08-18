import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { useWorkspaceInvoices } from './useWorkspaceInvoices'

describe('useWorkspaceInvoices', () => {
  it('paginates the list to the requested page size', () => {
    const { page, total, itemsPerPage, pagedItems } = useWorkspaceInvoices(
      '',
      11
    )
    expect(pagedItems.value).toHaveLength(itemsPerPage.value)

    const firstIds = pagedItems.value.map((i) => i.id)
    page.value = 2
    expect(pagedItems.value.map((i) => i.id)).not.toEqual(firstIds)

    const lastPage = Math.ceil(total.value / itemsPerPage.value)
    page.value = lastPage
    expect(pagedItems.value.length).toBeGreaterThan(0)
    expect(pagedItems.value.length).toBeLessThanOrEqual(itemsPerPage.value)
  })

  it('filters by event type and snaps the page back into range', async () => {
    const search = ref('')
    const { page, total, itemsPerPage, pagedItems } = useWorkspaceInvoices(
      search,
      11
    )
    const fullTotal = total.value

    page.value = 3
    search.value = 'subscription'
    await nextTick()

    expect(total.value).toBeLessThan(fullTotal)
    expect(
      pagedItems.value.every((i) => i.eventType === 'Subscription payment')
    ).toBe(true)
    // Page snaps back within range rather than stranding an empty page.
    expect(page.value).toBeLessThanOrEqual(
      Math.ceil(total.value / itemsPerPage.value)
    )
    expect(pagedItems.value.length).toBeGreaterThan(0)
  })

  it('sorts by price ascending and descending', () => {
    const { pagedItems, sortDirection, toggleSort } = useWorkspaceInvoices(
      '',
      11
    )

    toggleSort('price')
    const desc = pagedItems.value.map((i) => i.amountCents)
    expect([...desc].sort((a, b) => b - a)).toEqual(desc)

    toggleSort('price')
    expect(sortDirection.value).toBe('asc')
    const asc = pagedItems.value.map((i) => i.amountCents)
    expect([...asc].sort((a, b) => a - b)).toEqual(asc)
  })
})
