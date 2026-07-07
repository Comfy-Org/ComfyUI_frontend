import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

export interface Invoice {
  id: string
  date: Date
  eventType: string
  amountCents: number
}

// Prototype mock: there is no billing-history endpoint yet, so the invoice
// list is generated client-side and paginated in the browser.
const INVOICE_KINDS: Array<[eventType: string, amountCents: number]> = [
  ['Subscription payment', 32000],
  ['Auto-reload', 2400],
  ['Auto-reload', 2400],
  ['Additional credit top-up', 10000],
  ['Auto-reload', 2400],
  ['Subscription payment', 32000]
]

const DAY_MS = 24 * 60 * 60 * 1000
const BASE = new Date('2026-02-20T18:30:00').getTime()

function mockInvoices(): Invoice[] {
  return Array.from({ length: 44 }, (_, i) => {
    const [eventType, amountCents] = INVOICE_KINDS[i % INVOICE_KINDS.length]
    return {
      id: `inv-${i}`,
      date: new Date(BASE - i * DAY_MS),
      eventType,
      amountCents
    }
  })
}

export type InvoiceSortField = 'date' | 'eventType' | 'price'

export function useWorkspaceInvoices(
  search: MaybeRefOrGetter<string>,
  pageSize: MaybeRefOrGetter<number>
) {
  const all = mockInvoices()
  const page = ref(1)
  const perPage = computed(() => Math.max(1, toValue(pageSize)))
  const sortField = ref<InvoiceSortField>('date')
  const sortDirection = ref<'asc' | 'desc'>('desc')

  const filtered = computed(() => {
    const q = toValue(search).trim().toLowerCase()
    if (!q) return all
    return all.filter((invoice) => invoice.eventType.toLowerCase().includes(q))
  })

  const sorted = computed(() => {
    const dir = sortDirection.value === 'asc' ? 1 : -1
    return [...filtered.value].sort((a, b) => {
      if (sortField.value === 'price')
        return dir * (a.amountCents - b.amountCents)
      if (sortField.value === 'eventType')
        return dir * a.eventType.localeCompare(b.eventType)
      return dir * (a.date.getTime() - b.date.getTime())
    })
  })

  const total = computed(() => filtered.value.length)

  const pagedItems = computed(() => {
    const start = (page.value - 1) * perPage.value
    return sorted.value.slice(start, start + perPage.value)
  })

  function toggleSort(field: InvoiceSortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'desc'
    }
  }

  // Filtering or a shorter dialog can shrink the list past the current page;
  // snap back into range.
  watch([total, perPage], ([count]) => {
    const lastPage = Math.max(1, Math.ceil(count / perPage.value))
    if (page.value > lastPage) page.value = lastPage
  })

  return {
    page,
    total,
    itemsPerPage: perPage,
    pagedItems,
    sortField,
    sortDirection,
    toggleSort
  }
}
